/**
 * @file BlockLearningScheduler.ts
 * @description
 * [Responsibility & Scope]
 * This scheduler creates *block learning* StudySession objects for a given date and the
 * active LearningSet. It reads NotebookProgress to determine the next unlearned chunk
 * within each notebook’s current lesson, constructs a session that targets those units,
 * and advances progress (session history + unitsCoveredInBlockLearning). Each produced
 * session carries extra context (notebook, lesson, chunk) for downstream enrichment by
 * the SessionAggregator. The algorithm is linear in the number of notebooks (and small
 * lesson arrays) and it never mutates inputs other than explicitly updating progress.
 * Purposeful logs mark success/failure and core state transitions for observability.
 */

import type {
  StudySession,
  NotebookMeta,
  LessonUnit,
} from '@/app/Library/Definitions/CalendarDefinitions';
import type { LearningSet } from '../models/LearningSet';
import type { NotebookProgress, LessonProgress, CompletedBlockSession } from '../models/Progress';
import type { Lesson, LessonChunk } from '../models/Lesson';
import { DEFAULT_CHUNK_SIZE } from '../constants/schedulingConstants';
import { generateSessionId } from '../utils/sessionUtils';
import { calculateChunkCount } from '../utils/lessonUtils';

type LessonsByNotebook = Map<string, Lesson[]>;

interface NextChunkResult {
  lesson: Lesson;
  chunk: LessonChunk;
  lessonProgress: LessonProgress;
  startIndex: number;
  endIndex: number;
}

/**
 * @function scheduleBlockLearning
 * @description
 * For the provided date and active learning set, schedules at most one *block learning*
 * session per notebook in that set. It determines the next unlearned slice of a lesson
 * using unitsCoveredInBlockLearning, creates a StudySession with type 'block', and logs
 * a CompletedBlockSession in the notebook’s progress. Each session carries opaque fields
 * { notebook, lesson, chunk } (not part of StudySession’s public type) used downstream
 * by the SessionAggregator for metadata enrichment. O(K) where K ≤ 3 notebooks per set.
 */
export function scheduleBlockLearning(
  date: Date,
  learningSet: LearningSet,
  progressMap: Map<string, NotebookProgress>,
  lessonsByNotebook: LessonsByNotebook
): StudySession[] {
  const loc = 'core/BlockLearningScheduler.ts#3201';
  const sessions: StudySession[] = [];

  for (const notebook of learningSet.notebooks) {
    const nbId = notebook.fileId;
    const nbLessons = lessonsByNotebook.get(nbId) ?? [];
    const nbProgress = progressMap.get(nbId);
    if (!nbProgress) {
      // eslint-disable-next-line no-console
      console.log(`[${loc}] SKIP notebook=${nbId} (no progress)`);
      continue;
    }

    const next = getNextChunk(nbProgress, nbLessons);
    if (!next) {
      // eslint-disable-next-line no-console
      console.log(`[${loc}] SKIP notebook=${nbId} (no next chunk)`);
      continue;
    }

    // 1) Build the session (with extra context for enrichment later).
    const id = generateSessionId();
    const unitCount = next.chunk.units.length;
    const session: any = {
      id,
      date,
      notebookMeta: notebook,
      targetLessonUnits: next.chunk.units,
      type: 'block',
      sessionConfig: { unitCount: unitCount || DEFAULT_CHUNK_SIZE },
      // extra context for SessionAggregator enrichment
      notebook,
      lesson: next.lesson,
      chunk: next.chunk,
    };

    // 2) Update progress (block learning history + units covered).
    const record: CompletedBlockSession = {
      date,
      unitsCovered: next.chunk.units,
      startUnitIndex: next.startIndex,
      endUnitIndex: next.endIndex,
    };
    next.lessonProgress.blockLearningSessions.push(record);
    next.lessonProgress.unitsCoveredInBlockLearning = Math.min(
      next.lessonProgress.totalUnits,
      next.endIndex + 1
    );
    if (next.lessonProgress.status === 'not-started') {
      next.lessonProgress.status = 'in-progress';
    }

    // eslint-disable-next-line no-console
    console.log(
      `[${loc}] CREATED session=${id} nb=${notebook.fileName} lesson=${next.lesson.title} chunk=${next.chunk.chunkIndex + 1}/${next.chunk.totalChunks}`
    );

    sessions.push(session as StudySession);
  }

  // eslint-disable-next-line no-console
  console.log(`[${loc}] scheduleBlockLearning -> PASS created=${sessions.length}`);
  return sessions;
}

/**
 * @function getNextChunk
 * @description
 * Determines the next unlearned chunk for a notebook. It selects the first lesson whose
 * unitsCoveredInBlockLearning < totalUnits, computes the next contiguous slice using the
 * DEFAULT_CHUNK_SIZE, and returns the Lesson, the computed LessonChunk (with index/total),
 * the associated LessonProgress, and the [startIndex,endIndex] pair. If all lessons are
 * fully learned, it returns null. The method operates in O(L) where L is small.
 */
export function getNextChunk(
  notebookProgress: NotebookProgress,
  lessons: Lesson[]
): NextChunkResult | null {
  const loc = 'core/BlockLearningScheduler.ts#3202';

  for (let li = 0; li < lessons.length; li++) {
    const lesson = lessons[li];
    const lp = notebookProgress.lessonProgress.find((p) => p.lessonId === lesson.id);
    if (!lp) continue;

    if (lp.unitsCoveredInBlockLearning < lp.totalUnits) {
      const startIndex = lp.unitsCoveredInBlockLearning;
      const endIndex = Math.min(lp.totalUnits, startIndex + DEFAULT_CHUNK_SIZE) - 1;
      const units = lesson.units.slice(startIndex, endIndex + 1);
      const totalChunks = calculateChunkCount(lesson.units.length, DEFAULT_CHUNK_SIZE);
      const chunkIndex = Math.floor(startIndex / DEFAULT_CHUNK_SIZE);
      const chunk: LessonChunk = { units, chunkIndex, totalChunks };

      // eslint-disable-next-line no-console
      console.log(
        `[${loc}] nextChunk -> lesson=${lesson.title} start=${startIndex} end=${endIndex} chunk=${chunkIndex + 1}/${totalChunks}`
      );

      return { lesson, chunk, lessonProgress: lp, startIndex, endIndex };
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[${loc}] nextChunk -> NONE (all lessons learned)`);
  return null;
}
