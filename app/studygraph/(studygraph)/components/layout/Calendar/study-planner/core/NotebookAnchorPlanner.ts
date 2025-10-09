/**
 * @file core/NotebookAnchorPlanner.ts
 * @description
 * Responsibilities & Scope (detailed, ≥100 words)
 * This module provides **pure, deterministic helper utilities** used by the orchestrator during
 * *plan extension* to prevent duplicate block-learning sessions for the same notebook on the same
 * day. It centralizes four cohesive functions: (1) `hasPendingLearning` checks whether a notebook
 * still requires learning work based on its LessonProgress; (2) `hasBlockOnDate` verifies whether
 * a specific date already contains a block-learning session for that notebook inside the archived
 * `sessionsByDate` map; (3) `findNextEligibleLearningSetDay` scans forward from an anchor (≥ today)
 * across a precomputed learning-set schedule pattern to find the first date where the notebook’s
 * learning set is active and no duplicate exists; and (4) `makeSyntheticSetForNotebooks` constructs
 * a *subset learning set* containing only the notebooks that should receive learning on a given day.
 * All functions are side-effect free, leverage O(1)/O(N) simple loops, and include concise, file-
 * tagged console logs with searchable 4-digit codes. Keeping this logic out of the orchestrator
 * (SOLID – Single Responsibility) makes the main loop slimmer, easier to test, and less error-prone.
 */

import type { StudySession, NotebookMeta } from '@/app/Library/Definitions/CalendarDefinitions';
import type { LearningSet } from '../models/LearningSet';
import type { NotebookProgress } from '../models/Progress';
import type { ScheduleConfig } from '../models/Configuration';
import { formatDateKey, addDays, isDateAvailable } from '../utils/dateUtils';

const LOC = 'core/NotebookAnchorPlanner.ts#7401';

type SessionsByDate = Map<string, StudySession[]>;
type LearningSetSchedule = Map<string, LearningSet>;

/**
 * @function hasPendingLearning
 * @description
 * Returns true when the specified notebook has at least one lesson that is not completed.
 * This is used to select candidate notebooks for anchoring during extension operations.
 * Time complexity is O(L) where L is the number of lessons in the notebook; L is small
 * in practice and this function performs no mutations or I/O side effects.
 */
export function hasPendingLearning(progress: NotebookProgress | undefined): boolean {
  const ok = !!progress && progress.lessonProgress.some(lp => lp.status !== 'completed');
  // eslint-disable-next-line no-console
  console.log(`[${LOC}] hasPendingLearning nb=${progress?.notebookId ?? 'unknown'} -> ${ok} (7402)`);
  return ok;
}

/**
 * @function hasBlockOnDate
 * @description
 * Checks if the given date already contains a *block learning* session for the notebook.
 * We use the sessionsByDate archive from the existing plan; this prevents up-front creation
 * of duplicates and preserves historical intent. O(K) for the number of sessions on that day.
 */
export function hasBlockOnDate(
  sessionsByDate: SessionsByDate,
  dateKey: string,
  notebookId: string
): boolean {
  const list = sessionsByDate.get(dateKey) ?? [];
  const dup = list.some(s => (s as any).type === 'block' && s.notebookMeta?.fileId === notebookId);
  // eslint-disable-next-line no-console
  console.log(`[${LOC}] hasBlockOnDate date=${dateKey} nb=${notebookId} -> ${dup} (7403)`);
  return dup;
}

/**
 * @function findNextEligibleLearningSetDay
 * @description
 * Scans forward from `startDate` up to `scanDays` to find the first date where the notebook’s
 * learning set is active and *no* block session for that notebook already exists. The scan
 * respects DayAvailability from `config` and only considers dates the scheduler marked active
 * in `schedulePattern`. Returns `null` if nothing is found within the conservative bound.
 * Time complexity is O(D) with D ≤ scanDays and small constant work per day.
 */
export function findNextEligibleLearningSetDay(
  notebookId: string,
  learningSetId: string,
  startDate: Date,
  scanDays: number,
  schedulePattern: LearningSetSchedule,
  sessionsByDate: SessionsByDate,
  config: ScheduleConfig
): Date | null {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  for (let i = 0; i < scanDays; i++) {
    const cur = addDays(start, i);
    if (!isDateAvailable(cur, config)) continue;

    const key = formatDateKey(cur);
    const activeSet = schedulePattern.get(key);
    if (!activeSet || activeSet.id !== learningSetId) continue;

    if (!hasBlockOnDate(sessionsByDate, key, notebookId)) {
      // eslint-disable-next-line no-console
      console.log(`[${LOC}] anchor FOUND nb=${notebookId} date=${key} set=${learningSetId} (7404)`);
      return cur;
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[${LOC}] anchor NONE nb=${notebookId} scanned=${scanDays} (7405)`);
  return null;
}

/**
 * @function makeSyntheticSetForNotebooks
 * @description
 * Builds a *synthetic* LearningSet that contains only the supplied notebook IDs while preserving
 * the source set’s identity and display name. This allows the learning scheduler to create at most
 * one block per notebook on that date without modifying the global learning-set definition.
 * Complexity is O(N) over the source set’s notebooks with simple filtering.
 */
export function makeSyntheticSetForNotebooks(
  sourceSet: LearningSet,
  notebookIds: string[]
): LearningSet {
  const ids = new Set(notebookIds);
  const notebooks: NotebookMeta[] = sourceSet.notebooks.filter(nb => ids.has(nb.fileId));
  const synthetic: LearningSet = {
    id: sourceSet.id,
    name: `${sourceSet.name} (anchored)`,
    notebooks,
    scheduledDayPattern: sourceSet.scheduledDayPattern, // not used by block scheduler; retained for transparency
  };

  // eslint-disable-next-line no-console
  console.log(
    `[${LOC}] makeSyntheticSetForNotebooks base=${sourceSet.id} count=${notebooks.length} (7406)`
  );
  return synthetic;
}
