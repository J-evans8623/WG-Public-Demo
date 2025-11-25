/**
 * @file InterleavedRevisionScheduler.ts
 * @description
 * [Responsibility & Scope]
 * This module schedules **interleaved revision** sessions once a notebook records its first
 * completed lesson. Interleaved sessions begin exactly `INTERLEAVED_START_DELAY_DAYS` after
 * the first completion and then repeat every `INTERLEAVED_INTERVAL_DAYS` until the quota
 * equals `INTERLEAVED_REVISION_MULTIPLIER × totalLessonsInNotebook`. Importantly, sessions
 * only occur on dates where the notebook’s learning set is active (we align to the
 * precomputed learning-set schedule pattern). The algorithm is deliberately two-phase:
 * (1) when a newly-completed lesson is observed, we precompute and cache all aligned dates
 * in `InterleavedRevisionProgress.scheduledDates`; (2) on each calendar day, we check if
 * today is one of those dates and materialize a `revision-interleaved` session. This avoids
 * recomputation and duplication across days and allows idempotent orchestration. All work
 * here is O(N) across the affected notebooks and bounded by small constants in practice.
 * Logging is concise, with file-identifying tags and unique 4-digit codes for quick search.
 */

import type { StudySession, NotebookMeta } from '@/app/Library/Definitions/CalendarDefinitions';
import type { CompletedLesson } from './LessonCompletionDetector';
import type { LearningSet } from '../models/LearningSet';
import type { NotebookProgress } from '../models/Progress';
import type { Lesson } from '../models/Lesson';
import {
  INTERLEAVED_INTERVAL_DAYS,
  INTERLEAVED_REVISION_MULTIPLIER,
  INTERLEAVED_START_DELAY_DAYS,
} from '../constants/schedulingConstants';
import { addDays, formatDateKey } from '../utils/dateUtils';
import { generateSessionId } from '../utils/sessionUtils';

type LessonsByNotebook = Map<string, Lesson[]>;
type LearningSetSchedule = Map<string, LearningSet>; // dateKey -> learning set

/**
 * @function scheduleInterleavedRevisions
 * @description
 * Step-by-step responsibilities:
 * 1) Observe any newly completed lessons and initialize the notebook’s interleaved program
 *    if it hasn’t been initialized yet. This step computes the full date list (aligned to
 *    the learning-set schedule) and persists it in progress.
 * 2) Check whether the `currentDate` matches one of the precomputed dates. If so, create a
 *    `revision-interleaved` StudySession (content selection happens elsewhere in the app).
 * 3) Never duplicate sessions; we rely on the cached `scheduledDates` and the orchestrator’s
 *    once-per-day evaluation. This function mutates only notebook progress fields by design.
 */
export function scheduleInterleavedRevisions(
  completedLessons: CompletedLesson[],
  progressMap: Map<string, NotebookProgress>,
  currentDate: Date,
  learningSetSchedule: LearningSetSchedule,
  lessonsByNotebook: LessonsByNotebook
): StudySession[] {
  const loc = 'core/InterleavedRevisionScheduler.ts#3501';
  const sessions: StudySession[] = [];
  const todayKey = formatDateKey(currentDate);

  // Step 1) Initialize / plan dates when the first completion arrives for a notebook.
  for (const c of completedLessons) {
    const nbProgress = progressMap.get(c.notebookId);
    const lessons = lessonsByNotebook.get(c.notebookId) ?? [];
    if (!nbProgress) continue;

    const totalLessons = lessons.length;
    const quota = totalLessons * INTERLEAVED_REVISION_MULTIPLIER;
    const ilp = nbProgress.interleavedRevisionProgress;

    // Initialize first-session anchor if this is the first completion.
    if (!ilp.firstSessionDate) {
      const first = addDays(c.completionDate, INTERLEAVED_START_DELAY_DAYS);
      ilp.firstSessionDate = first;
      ilp.totalRequired = quota;

      // Precompute and store all candidate dates aligned to learning-set active days.
      const aligned = calculateInterleavedDates(
        first,
        quota,
        learningSetSchedule,
        nbProgress.learningSetId
      );
      ilp.scheduledDates = aligned;
      ilp.sessionsScheduled = aligned.length;

      // eslint-disable-next-line no-console
      console.log(
        `[${loc}] PLAN nb=${c.notebookId} quota=${quota} first=${first.toISOString()} planned=${aligned.length}`
      );
    }
  }

  // Step 2) If today matches any preplanned date for a notebook, materialize a session.
  for (const [nbId, nbProgress] of progressMap.entries()) {
    const planned = nbProgress.interleavedRevisionProgress.scheduledDates ?? [];
    const match = planned.find((d) => formatDateKey(d) === todayKey);
    if (!match) continue;

    const lessons = lessonsByNotebook.get(nbId) ?? [];
    const notebookMeta = deriveNotebookMeta(nbProgress); // best-effort snapshot

    const session = createInterleavedSession(match, notebookMeta, lessons);
    sessions.push(session);

    // eslint-disable-next-line no-console
    console.log(`[${loc}] CREATED interleaved nb=${notebookMeta.fileName} date=${todayKey}`);
  }

  // eslint-disable-next-line no-console
  console.log(`[${loc}] scheduleInterleavedRevisions -> PASS created=${sessions.length}`);
  return sessions;
}

/**
 * @function calculateInterleavedDates
 * @description
 * Computes the list of interleaved revision dates, starting at `firstCompletionDate`
 * (which is already offset by `INTERLEAVED_START_DELAY_DAYS` by the caller) and then
 * stepping forward by `INTERLEAVED_INTERVAL_DAYS`. Only dates where the notebook’s
 * learning set is active (per `learningSetSchedule`) are retained. The scan stops once
 * `totalRequired` dates are collected or a conservative upper bound is reached. Results
 * are deterministic and safe to cache for the lifetime of the plan.
 */
export function calculateInterleavedDates(
  firstCompletionDate: Date,
  totalRequired: number,
  learningSetSchedule: LearningSetSchedule,
  learningSetId: string
): Date[] {
  const loc = 'core/InterleavedRevisionScheduler.ts#3502';
  const out: Date[] = [];
  let cursor = addDays(firstCompletionDate, 0);

  // Scan forward; include only dates where the notebook's learning set is active.
  const maxScans = Math.max(totalRequired * 20, 60); // safety cap to avoid pathological loops
  for (let i = 0; i < maxScans && out.length < totalRequired; i++) {
    const key = formatDateKey(cursor);
    const ls = learningSetSchedule.get(key);
    if (ls && ls.id === learningSetId) {
      out.push(cursor);
    }
    cursor = addDays(cursor, INTERLEAVED_INTERVAL_DAYS);
  }

  // eslint-disable-next-line no-console
  console.log(
    `[${loc}] calculateInterleavedDates -> start=${firstCompletionDate.toISOString()} need=${totalRequired} got=${out.length}`
  );
  return out;
}

/**
 * @function createInterleavedSession
 * @description
 * Produces a `revision-interleaved` StudySession positioned on the provided date. Content
 * selection (which specific lessons/units to review) occurs elsewhere in the application,
 * so this scheduler intentionally sets `targetLessonUnits` to an empty array and relies on
 * the downstream player to resolve randomized cross-lesson content. The session carries a
 * robust ID and the notebook’s metadata for calendar coloring and labeling.
 */
function createInterleavedSession(
  date: Date,
  notebook: NotebookMeta,
  _allLessons: Lesson[]
): StudySession {
  const loc = 'core/InterleavedRevisionScheduler.ts#3503';
  const id = generateSessionId();

  const session: StudySession = {
    id,
    date,
    notebookMeta: notebook as any,
    targetLessonUnits: [], // content selection handled by the revision player
    type: 'revision-interleaved',
    sessionConfig: { unitCount: 0 },
    metadata: {
      // SessionAggregator will enrich when chunk context is present; for interleaved we set minimally
      sessionTitle: `${notebook.fileName} — Interleaved Revision`,
      estimatedDuration: 20,
      topicTitles: [],
    },
  } as any;

  // eslint-disable-next-line no-console
  console.log(`[${loc}] createInterleavedSession -> id=${id} nb=${notebook.fileName}`);
  return session;
}

/**
 * @function deriveNotebookMeta
 * @description
 * Returns the best-available `NotebookMeta` for a notebook at scheduling time. We prefer
 * the cached `notebookMetaSnapshot` from `NotebookProgress` for stability; if unavailable,
 * we synthesize a minimal object using the ID and name information the system guarantees.
 * This keeps session objects self-contained for calendar rendering with consistent labels.
 */
function deriveNotebookMeta(progress: NotebookProgress): NotebookMeta {
  const loc = 'core/InterleavedRevisionScheduler.ts#3504';
  if (progress.notebookMetaSnapshot) {
    // eslint-disable-next-line no-console
    console.log(`[${loc}] using snapshot for nb=${progress.notebookMetaSnapshot.fileName}`);
    return progress.notebookMetaSnapshot as unknown as NotebookMeta;
  }

  // Fallback: construct a minimal meta; downstream code expects at least id+name.
  const fallback = {
    fileId: progress.notebookId,
    fileName: `Notebook ${progress.notebookId}`,
    color: '#777777',
  } as unknown as NotebookMeta;

  // eslint-disable-next-line no-console
  console.log(`[${loc}] using fallback meta for nb=${progress.notebookId}`);
  return fallback;
}
