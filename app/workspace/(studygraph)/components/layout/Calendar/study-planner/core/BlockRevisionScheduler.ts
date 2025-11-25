/**
 * @file BlockRevisionScheduler.ts
 * @description
 * [Responsibility & Scope]
 * This scheduler mirrors *block learning* sessions from the previous available day by
 * creating corresponding *block revision* sessions on the current date. Each revision
 * “replays” the exact same lesson units (1:1 correspondence) and updates progress by
 * adding a CompletedBlockSession to blockRevisionSessions. The scheduler relies on the
 * extra context added by BlockLearningScheduler (lesson metadata / chunk indices) to
 * update progress deterministically. It never mutates inputs other than progress and
 * emits concise logs at the most informative points for debugging. Complexity is O(N)
 * in the number of previous-day sessions, typically small due to learning set limits.
 */

import type { StudySession } from '@/app/Library/Definitions/CalendarDefinitions';
import type { NotebookProgress } from '../models/Progress';
import type { LearningSet } from '../models/LearningSet';
import { generateSessionId } from '../utils/sessionUtils';

/**
 * @function scheduleBlockRevision
 * @description
 * Given the current date and the previous day’s sessions, produces corresponding
 * 'revision-block' sessions for each prior 'block' session. It updates the lesson’s
 * blockRevisionSessions history in progress. The function is defensive: if it cannot
 * locate the relevant progress record, it skips with a log. The returned sessions
 * carry the same extra { notebook, lesson, chunk } context for later enrichment.
 */
export function scheduleBlockRevision(
  date: Date,
  previousDaySessions: StudySession[],
  progressMap: Map<string, NotebookProgress>,
  currentLearningSet?: LearningSet,
  previousLearningSet?: LearningSet
): StudySession[] {
  const loc = 'core/BlockRevisionScheduler.ts#3301';
  const out: StudySession[] = [];
  const prevBlocks = previousDaySessions.filter((s) => (s as any).type === 'block');

  // Optional validation: ensure alternation between learning sets
  if (currentLearningSet && previousLearningSet && currentLearningSet.id === previousLearningSet.id) {
    // eslint-disable-next-line no-console
    console.log(`[${loc}] WARN (same learning set on consecutive available days) current=${currentLearningSet.id}`);
  }

  for (const prev of prevBlocks) {
    const nb = (prev as any).notebook as { fileId: string; fileName: string } | undefined;
    const lesson = (prev as any).lesson as { id: string; title: string } | undefined;
    const chunk = (prev as any).chunk as { units: unknown[]; chunkIndex: number; totalChunks: number } | undefined;

    if (!nb || !lesson || !chunk) {
      // eslint-disable-next-line no-console
      console.log(`[${loc}] SKIP (missing context on previous session) id=${(prev as any).id ?? 'unknown'}`);
      continue;
    }

    const nbProgress = progressMap.get(nb.fileId);
    if (!nbProgress) {
      // eslint-disable-next-line no-console
      console.log(`[${loc}] SKIP (no progress for notebook) nb=${nb.fileId}`);
      continue;
    }

    const lp = nbProgress.lessonProgress.find((p) => p.lessonId === lesson.id);
    if (!lp) {
      // eslint-disable-next-line no-console
      console.log(`[${loc}] SKIP (no lesson progress) lesson=${lesson.title}`);
      continue;
    }

    // Create the revision session using the same units as the learning session.
    const id = generateSessionId();
    const session: any = {
      id,
      date,
      notebookMeta: (prev as any).notebookMeta,
      targetLessonUnits: chunk.units,
      type: 'revision-block',
      sessionConfig: { unitCount: chunk.units.length },
      notebook: (prev as any).notebook,
      lesson,
      chunk,
    };

    // Update progress: record mirrored revision block.
    lp.blockRevisionSessions.push({
      date,
      unitsCovered: chunk.units as any,
      startUnitIndex: (prev as any).startUnitIndex ?? chunk.chunkIndex * 3,
      endUnitIndex: (prev as any).endUnitIndex ?? (chunk.chunkIndex * 3 + (chunk.units.length - 1)),
    });

    // eslint-disable-next-line no-console
    console.log(
      `[${loc}] CREATED revision id=${id} nb=${nb.fileName} lesson=${lesson.title} chunk=${chunk.chunkIndex + 1}/${chunk.totalChunks}`
    );

    out.push(session as StudySession);
  }

  // eslint-disable-next-line no-console
  console.log(`[${loc}] scheduleBlockRevision -> PASS created=${out.length}`);
  return out;
}
