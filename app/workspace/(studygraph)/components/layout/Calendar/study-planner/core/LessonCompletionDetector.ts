/**
 * @file LessonCompletionDetector.ts
 * @description
 * [Responsibility & Scope]
 * This component inspects per-notebook LessonProgress to identify lessons whose required
 * work is fully satisfied: (1) every unit has been covered by block learning, and (2) the
 * count of block revision sessions exactly mirrors the number of block learning sessions.
 * When a lesson reaches this condition for the first time, the detector marks its status
 * as 'completed', stamps a completionDate, and returns a compact record describing that
 * event. The orchestrator uses these events to trigger interleaved revision scheduling.
 * The logic is linear in total lessons and does not mutate state except status stamping.
 * Purposeful logs make it straightforward to trace completion decisions in production.
 */

import type { NotebookProgress, LessonProgress } from '../models/Progress';

export interface CompletedLesson {
  notebookId: string;
  lessonId: string;
  completionDate: Date;
  lessonProgress: LessonProgress;
}

/**
 * @function detectCompletions
 * @description
 * Scans the entire progress map to locate lessons that have become complete *today*.
 * A lesson is complete when its learned-unit count equals totalUnits AND the counts of
 * learning and revision sessions match. Newly completed lessons are updated in-place
 * (status + completionDate) and returned for downstream scheduling. O(L) across all
 * lessons; small constants in practice.
 */
export function detectCompletions(
  progressMap: Map<string, NotebookProgress>,
  currentDate: Date
): CompletedLesson[] {
  const loc = 'core/LessonCompletionDetector.ts#3401';
  const out: CompletedLesson[] = [];

  for (const [nbId, nbProgress] of progressMap.entries()) {
    for (const lp of nbProgress.lessonProgress) {
      if (lp.status === 'completed') continue;

      if (isLessonComplete(lp)) {
        lp.status = 'completed';
        lp.completionDate = currentDate;

        out.push({
          notebookId: nbId,
          lessonId: lp.lessonId,
          completionDate: currentDate,
          lessonProgress: lp,
        });

        // eslint-disable-next-line no-console
        console.log(
          `[${loc}] COMPLETE nb=${nbId} lesson=${lp.lessonId} date=${currentDate.toISOString()}`
        );
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[${loc}] detectCompletions -> PASS count=${out.length}`);
  return out;
}

/**
 * @function isLessonComplete
 * @description
 * Returns true if all units have been covered in block learning *and* the number of block
 * revision sessions equals the number of block learning sessions. This ensures the 1:1
 * mirror rule is satisfied, preventing premature completion while revisions are pending.
 * O(1) checks; no mutation.
 */
export function isLessonComplete(lp: LessonProgress): boolean {
  const learnedAll = lp.unitsCoveredInBlockLearning >= lp.totalUnits;
  const mirrored = lp.blockLearningSessions.length === lp.blockRevisionSessions.length;
  return learnedAll && mirrored;
}
