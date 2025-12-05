/**
 * @file ScheduleReconfigurator.ts
 * @description
 * [Responsibility & Scope]
 * This module implements the "Flexible Update Logic" strategy acting as a specialized
 * state mutation service. Its primary responsibility is to take an existing frozen
 * `StudyPlanState` and transform it to accommodate structural changes—specifically
 * the addition of new, untracked notebooks. It enforces business rules for "Learning
 * Set Balancing" (determining if notebooks should be split into multiple sets based
 * on volume) and "Time Anchoring" (resetting the scheduling cursor to the current date).
 * By stripping future sessions from the internal maps and resetting the `nextAvailableDate`,
 * it prepares the state so that the `StudyPlanOrchestrator` can regenerate a valid,
 * balanced schedule starting from "Today" without overwriting historical progress.
 * This ensures users can add subjects mid-semester without losing their past completion data.
 */

import type { StudyPlanState } from './models/StudyPlanOutput';
import type { NotebookMeta } from '@/app/Library/Definitions/CalendarDefinitions';
import type { LearningSet } from './models/LearningSet';
import type { NotebookProgress } from './models/Progress';
import { NOTEBOOK_SPLIT_THRESHOLD, ID_PREFIX } from './constants/schedulingConstants';
import { formatDateKey } from './utils/dateUtils';

/**
 * @function reconfigureStateForUpdate
 * @description
 * Analyzes the incoming list of notebooks against the existing state to perform a
 * structural reconfiguration. It executes the following pipeline:
 * 1. Redistributes all notebooks (existing + new) into optimal LearningSets (1 or 2 sets).
 * 2. Updates `notebookProgress` mapping:
 * - Existing books: Preserves history/IDs but updates the `learningSetId` pointer.
 * - New books: Initializes fresh progress records compliant with strict interfaces.
 * 3. Truncates `sessionsByDate`: Removes any sessions >= `anchorDate` to clear the
 * future timeline, preventing collisions with the newly generated schedule.
 * 4. Resets `nextAvailableDate` to `anchorDate`.
 *
 * @param existingState The current frozen state of the study plan.
 * @param allNotebooks The comprehensive list of notebooks (tracked + new) to include.
 * @param anchorDate The date from which the new schedule structure should begin (usually Today).
 * @returns A new, mutated StudyPlanState ready for the Orchestrator.
 */
export function reconfigureStateForUpdate(
  existingState: StudyPlanState,
  allNotebooks: NotebookMeta[],
  anchorDate: Date
): StudyPlanState {
  const loc = 'core/ScheduleReconfigurator.ts';

  // 1. Re-Distribute Notebooks into Learning Sets
  // We treat this as a fresh distribution of the *current* list to ensure balance.
  // Logic: <= 3 notebooks = 1 Set; > 3 notebooks = 2 Sets (split evenly).
  const newLearningSets = rebalanceLearningSets(allNotebooks);

  // 2. Update Notebook Progress Map
  // We must preserve existing progress but update the 'learningSetId' pointer.
  // We must also create new progress entries for untracked notebooks.
  const newProgressMap = new Map<string, NotebookProgress>();

  // Helper to find which set a notebook landed in
  const findSetId = (nbId: string): string => {
    const set = newLearningSets.find((ls) => ls.notebooks.some((n) => n.fileId === nbId));
    return set ? set.id : '';
  };

  for (const notebook of allNotebooks) {
    const existingProgress = existingState.notebookProgress.get(notebook.fileId);
    const targetSetId = findSetId(notebook.fileId);

    if (existingProgress) {
      // Preserve history, just update the structural pointer
      newProgressMap.set(notebook.fileId, {
        ...existingProgress,
        learningSetId: targetSetId,
        // Update snapshot to the latest meta (e.g., if title/color changed)
        notebookMetaSnapshot: notebook as any,
      });
    } else {
      // Initialize new progress for the untracked notebook
      newProgressMap.set(notebook.fileId, {
        notebookId: notebook.fileId,
        learningSetId: targetSetId,
        lessonProgress: [], // Will be populated by Orchestrator -> BlockLearningScheduler
        interleavedRevisionProgress: {
          sessionsScheduled: 0,
          totalRequired: 0,
          sessionsCompleted: 0, // Added to satisfy interface
          scheduledDates: [],   // Added to satisfy interface
        },
        notebookMetaSnapshot: notebook as any,
      });
    }
  }

  // 3. Truncate Future Sessions from State Map
  // We remove any sessions scheduled >= anchorDate from the state's internal map
  // to ensure the Orchestrator sees a clean slate for future dates.
  const newSessionsByDate = new Map<string, any[]>();
  // Normalize anchor to start of day for comparison
  const anchorTime = new Date(anchorDate).setHours(0, 0, 0, 0);

  for (const [dateKey, sessions] of existingState.sessionsByDate.entries()) {
    // If the bucket has sessions, check the date of the first one
    if (sessions.length > 0) {
      const sessionDate = new Date(sessions[0].date);
      // Keep only strictly past sessions (before today)
      if (sessionDate.getTime() < anchorTime) {
        newSessionsByDate.set(dateKey, sessions);
      }
    }
  }


  return {
    ...existingState,
    learningSets: newLearningSets,
    notebookProgress: newProgressMap,
    sessionsByDate: newSessionsByDate,
    nextAvailableDate: anchorDate,
    config: existingState.config, // Configuration remains unchanged
  };
}

/**
 * @function rebalanceLearningSets
 * @description
 * Internal helper to distribute notebooks based on volume.
 * - 1 set if 3 or fewer notebooks.
 * - 2 sets if 4 or more notebooks (capped at 2 sets for algorithm simplicity).
 * - Distributes notebooks evenly between the two sets if split.
 */
function rebalanceLearningSets(notebooks: NotebookMeta[]): LearningSet[] {
  const total = notebooks.length;
  if (total === 0) return [];

  // Requirement: "If at least three notebooks [already inside]... create a second Learning set"
  // Logic: > 3 notebooks implies splitting.
  const needsTwoSets = total > NOTEBOOK_SPLIT_THRESHOLD;
  const numSets = needsTwoSets ? 2 : 1;

  const out: LearningSet[] = [];
  const baseSize = Math.floor(total / numSets);
  const remainder = total % numSets;

  let cursor = 0;
  for (let i = 0; i < numSets; i++) {
    // Distribute remainder to first buckets (e.g., 5 items -> [3, 2])
    const size = baseSize + (i < remainder ? 1 : 0);
    const slice = notebooks.slice(cursor, cursor + size);
    cursor += size;

    const id = `${ID_PREFIX.LSET}-${String.fromCharCode(65 + i)}`; // LS-A, LS-B
    const name = `Learning Set ${String.fromCharCode(65 + i)}`;

    out.push({
      id,
      name,
      notebooks: slice,
      scheduledDayPattern: [], // Populated by LearningSetScheduler later
    });
  }

  return out;
}