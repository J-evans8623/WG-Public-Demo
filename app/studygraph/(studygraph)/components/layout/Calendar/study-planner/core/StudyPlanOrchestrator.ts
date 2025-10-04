/**
 * @file StudyPlanOrchestrator.ts
 * @description
 * [Responsibility & Scope]
 * This orchestrator is the **brain** of the Study Planner. It coordinates every step
 * required to transform notebook metadata into a calendar of study sessions that obey
 * all timing constraints (block → next-day revision → interleaved cadence). The module
 * accepts its dependencies through constructor injection to maximize testability; each
 * dependency is a small interface whose methods are pure functions implemented in other
 * files. The orchestrator performs five major tasks: (1) parse lessons and build fast
 * lookup tables; (2) distribute notebooks into learning sets and compute the schedule
 * pattern of which set is active on each available day; (3) initialize a durable, typed
 * progress map tracking per-lesson state and interleaved quotas; (4) iterate day-by-day
 * to schedule block learning, mirror block revisions, detect completions, schedule
 * interleaved sessions, and aggregate all outputs; and (5) build `StudyPlanOutput` with
 * metadata and serializable state so callers can extend plans later. All loops are O(N)
 * in the number of days or units processed with small, bounded constants, and concise
 * console logs provide observability at key checkpoints without polluting hot paths.
 */

import type {
  StudySession,
  NotebookMeta,
  LessonUnit,
} from '@/app/Library/Definitions/CalendarDefinitions';
import type { ScheduleConfig } from '../models/Configuration';
import type { StudyPlanOutput, StudyPlanState, PlanMetadata } from '../models/StudyPlanOutput';
import type { LearningSet } from '../models/LearningSet';
import type { NotebookProgress, LessonProgress } from '../models/Progress';
import type { Lesson, LessonChunk } from '../models/Lesson';

import { DEFAULT_CHUNK_SIZE, INTERLEAVED_REVISION_MULTIPLIER } from '../constants/schedulingConstants';
import { addDays, formatDateKey, isDateAvailable } from '../utils/dateUtils';
import { calculateChunkCount } from '../utils/lessonUtils';

// --- Dependency Contracts (small, easily mockable) -------------------------

interface ILearningSetFns {
  distribute: (notebooks: NotebookMeta[]) => LearningSet[];
  buildSchedulePattern: (
    startDate: Date,
    learningSets: LearningSet[],
    config: ScheduleConfig,
    totalDays: number
  ) => Map<string, LearningSet>;
}

interface ILessonFns {
  parseLessons: (notebook: NotebookMeta) => Lesson[];
  chunkLesson: (lesson: Lesson, chunkSize?: number) => LessonChunk[];
}

interface IBlockFns {
  scheduleBlockLearning: (
    date: Date,
    learningSet: LearningSet,
    progressMap: Map<string, NotebookProgress>,
    lessonsByNotebook: Map<string, Lesson[]>
  ) => StudySession[];
  scheduleBlockRevision: (
    date: Date,
    previousDaySessions: StudySession[],
    progressMap: Map<string, NotebookProgress>,
    currentLearningSet?: LearningSet,
    previousLearningSet?: LearningSet
  ) => StudySession[];
}

interface ICompletionAndInterleavedFns {
  detectCompletions: (progressMap: Map<string, NotebookProgress>, currentDate: Date) => {
    notebookId: string;
    lessonId: string;
    completionDate: Date;
    lessonProgress: LessonProgress;
  }[];
  scheduleInterleavedRevisions: (
    completedLessons: {
      notebookId: string;
      lessonId: string;
      completionDate: Date;
      lessonProgress: LessonProgress;
    }[],
    progressMap: Map<string, NotebookProgress>,
    currentDate: Date,
    learningSetSchedule: Map<string, LearningSet>,
    lessonsByNotebook: Map<string, Lesson[]>
  ) => StudySession[];
}

interface IAggregationFns {
  aggregateSessions: (
    date: Date,
    blockLearningSessions: StudySession[],
    blockRevisionSessions: StudySession[],
    interleavedSessions: StudySession[]
  ) => StudySession[];
}

// --- Orchestrator ----------------------------------------------------------

export class StudyPlanOrchestrator {
  private learningSetFns: ILearningSetFns;
  private lessonFns: ILessonFns;
  private blockFns: IBlockFns;
  private completionFns: ICompletionAndInterleavedFns;
  private aggregationFns: IAggregationFns;

  constructor(
    learningSetFns: ILearningSetFns,
    lessonFns: ILessonFns,
    blockFns: IBlockFns,
    completionFns: ICompletionAndInterleavedFns,
    aggregationFns: IAggregationFns
  ) {
    this.learningSetFns = learningSetFns;
    this.lessonFns = lessonFns;
    this.blockFns = blockFns;
    this.completionFns = completionFns;
    this.aggregationFns = aggregationFns;
  }

  /**
   * @function generatePlan
   * @description
   * Drives the full schedule generation: parse all lessons, distribute notebooks into
   * learning sets, initialize progress, compute a date→learning-set pattern, iterate each
   * available day in chronological order, invoke schedulers in the correct sequence, and
   * aggregate sessions. Returns a `StudyPlanOutput` containing flat sessions, plan metadata,
   * and extendable internal state. The loop is O(D) in the number of days scanned; all per-
   * day operations are O(K) where K ≤ 3 notebooks per active learning set.
   */
  public generatePlan(
    notebooks: NotebookMeta[],
    config: ScheduleConfig,
    startDate: Date
  ): StudyPlanOutput {
    const loc = 'core/StudyPlanOrchestrator.ts#5201';

    // Step 1) Parse lessons and build lookup maps.
    const lessonsByNotebook: Map<string, Lesson[]> = new Map();
    for (const nb of notebooks) {
      const lessons = this.lessonFns.parseLessons(nb);
      lessonsByNotebook.set(nb.fileId, lessons);
    }
    // eslint-disable-next-line no-console
    console.log(`[${loc}] parsed lessons -> notebooks=${lessonsByNotebook.size}`);

    // Step 2) Distribute notebooks into balanced learning sets.
    const learningSets = this.learningSetFns.distribute(notebooks);

    // Step 3) Initialize per-notebook progress using parsed lessons.
    const progressMap = this.initializeProgress(notebooks, learningSets, lessonsByNotebook);

    // Step 4) Estimate plan length and compute schedule pattern.
    const totalDays = this.calculateTotalDays(notebooks, learningSets, lessonsByNotebook);
    const schedulePattern = this.learningSetFns.buildSchedulePattern(
      startDate,
      learningSets,
      config,
      totalDays
    );

    // Step 5) Main day-by-day loop.
    const sessionsByDate = new Map<string, StudySession[]>();
    const allSessions: StudySession[] = [];
    let prevDaySessions: StudySession[] = [];
    let prevActiveSet: LearningSet | undefined;

    for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
      const currentDate = addDays(startDate, dayOffset);
      if (!isDateAvailable(currentDate, config)) {
        continue;
      }

      const key = formatDateKey(currentDate);
      const activeSet = schedulePattern.get(key);

      // 5a) Schedule block learning for the active set (if any).
      const blockLearning = activeSet
        ? this.blockFns.scheduleBlockLearning(currentDate, activeSet, progressMap, lessonsByNotebook)
        : [];

      // 5b) Schedule block revisions (mirror yesterday’s blocks).
      const blockRevision = this.blockFns.scheduleBlockRevision(
        currentDate,
        prevDaySessions,
        progressMap,
        activeSet,
        prevActiveSet
      );

      // 5c) Detect any lesson completions caused by today’s revisions.
      const completedLessons = this.completionFns.detectCompletions(progressMap, currentDate);

      // 5d) Attempt interleaved sessions planned for today.
      const interleaved = this.completionFns.scheduleInterleavedRevisions(
        completedLessons,
        progressMap,
        currentDate,
        schedulePattern,
        lessonsByNotebook
      );

      // 5e) Aggregate and store.
      const daySessions = this.aggregationFns.aggregateSessions(
        currentDate,
        blockLearning,
        blockRevision,
        interleaved
      );
      if (daySessions.length > 0) {
        sessionsByDate.set(key, daySessions);
        allSessions.push(...daySessions);
      }

      // Prepare for next loop.
      prevDaySessions = daySessions;
      prevActiveSet = activeSet;
    }

    // Step 6) Build metadata + state.
    const planMetadata = this.buildPlanMetadata(allSessions, startDate, learningSets.length);
    const state: StudyPlanState = {
      learningSets,
      notebookProgress: progressMap,
      sessionsByDate,
      nextAvailableDate: addDays(startDate, totalDays),
      config,
    };

    // eslint-disable-next-line no-console
    console.log(
      `[${loc}] generatePlan -> PASS days=${totalDays} sessions=${planMetadata.totalSessions} end=${planMetadata.endDate.toISOString()}`
    );

    return {
      sessions: allSessions,
      planMetadata,
      state,
    };
  }

  /**
   * @function extendPlan
   * @description
   * Resumes planning from a previously returned `StudyPlanState`. The method rebuilds fast
   * lesson lookups from the updated notebooks, reuses learning sets and progress, recomputes
   * a future schedule window, and iterates forward beginning at `state.nextAvailableDate`.
   * It appends sessions to the existing plan without mutating prior results. Complexity is
   * O(D) in the number of additional days scanned with the same small constants per day.
   */
  public extendPlan(
    existing: StudyPlanState,
    updatedNotebooks: NotebookMeta[]
  ): StudyPlanOutput {
    const loc = 'core/StudyPlanOrchestrator.ts#5202';

    // Rebuild lessons map from updated notebooks (e.g., new units/lessons added).
    const lessonsByNotebook: Map<string, Lesson[]> = new Map();
    for (const nb of updatedNotebooks) {
      const lessons = this.lessonFns.parseLessons(nb);
      lessonsByNotebook.set(nb.fileId, lessons);
    }

    // Reuse learning sets and progress.
    const { learningSets, notebookProgress: progressMap, config } = existing;
    const startDate = existing.nextAvailableDate;

    // Compute new bounds and schedule pattern from extension start.
    const totalDays = this.calculateTotalDays(updatedNotebooks, learningSets, lessonsByNotebook);
    const schedulePattern = this.learningSetFns.buildSchedulePattern(
      startDate,
      learningSets,
      config,
      totalDays
    );

    const sessionsByDate = new Map<string, StudySession[]>(existing.sessionsByDate);
    const allSessions: StudySession[] = [];
    let prevDaySessions: StudySession[] = [];
    let prevActiveSet: LearningSet | undefined;

    for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
      const currentDate = addDays(startDate, dayOffset);
      if (!isDateAvailable(currentDate, config)) continue;
      const key = formatDateKey(currentDate);
      const activeSet = schedulePattern.get(key);

      const blockLearning = activeSet
        ? this.blockFns.scheduleBlockLearning(currentDate, activeSet, progressMap, lessonsByNotebook)
        : [];

      const blockRevision = this.blockFns.scheduleBlockRevision(
        currentDate,
        prevDaySessions,
        progressMap,
        activeSet,
        prevActiveSet
      );

      const completed = this.completionFns.detectCompletions(progressMap, currentDate);
      const interleaved = this.completionFns.scheduleInterleavedRevisions(
        completed,
        progressMap,
        currentDate,
        schedulePattern,
        lessonsByNotebook
      );

      const daySessions = this.aggregationFns.aggregateSessions(
        currentDate,
        blockLearning,
        blockRevision,
        interleaved
      );

      if (daySessions.length > 0) {
        const existingList = sessionsByDate.get(key) ?? [];
        sessionsByDate.set(key, [...existingList, ...daySessions]);
        allSessions.push(...daySessions);
      }

      prevDaySessions = daySessions;
      prevActiveSet = activeSet;
    }

    const planMetadata = this.buildPlanMetadata(
      allSessions,
      existing.nextAvailableDate,
      learningSets.length
    );

    const state: StudyPlanState = {
      learningSets,
      notebookProgress: progressMap,
      sessionsByDate,
      nextAvailableDate: addDays(startDate, totalDays),
      config,
    };

    // eslint-disable-next-line no-console
    console.log(
      `[${loc}] extendPlan -> PASS days=${totalDays} sessionsAppended=${planMetadata.totalSessions}`
    );

    return {
      sessions: allSessions,
      planMetadata,
      state,
    };
  }

  /**
   * @function initializeProgress
   * @description
   * Creates a `NotebookProgress` for every notebook, deriving lesson progress entries from
   * parsed lessons and computing the interleaved quota (3 × lesson count). The method also
   * stores a small snapshot of notebook metadata (id, name, colorCode) to support session
   * enrichment without repeated lookups. Runs in O(N) overall where N is the total number
   * of lessons across notebooks, and performs no I/O or external side effects.
   */
  private initializeProgress(
    notebooks: NotebookMeta[],
    learningSets: LearningSet[],
    lessonsByNotebook: Map<string, Lesson[]>
  ): Map<string, NotebookProgress> {
    const loc = 'core/StudyPlanOrchestrator.ts#5203';
    const progress = new Map<string, NotebookProgress>();

    const learningSetByNotebook = new Map<string, string>();
    for (const ls of learningSets) {
      for (const nb of ls.notebooks) learningSetByNotebook.set(nb.fileId, ls.id);
    }

    for (const nb of notebooks) {
      const lessons = lessonsByNotebook.get(nb.fileId) ?? [];
      const lpArray: LessonProgress[] = lessons.map((lesson) => ({
        lessonId: lesson.id,
        lessonUnits: lesson.units,
        totalUnits: lesson.units.length,
        unitsCoveredInBlockLearning: 0,
        blockLearningSessions: [],
        blockRevisionSessions: [],
        status: 'not-started',
      }));

      progress.set(nb.fileId, {
        notebookId: nb.fileId,
        learningSetId: learningSetByNotebook.get(nb.fileId)!,
        lessonProgress: lpArray,
        interleavedRevisionProgress: {
          totalRequired: lessons.length * INTERLEAVED_REVISION_MULTIPLIER,
          sessionsScheduled: 0,
          sessionsCompleted: 0,
          scheduledDates: [],
        },
        notebookMetaSnapshot: {
          fileId: nb.fileId,
          fileName: nb.fileName,
          colorCode: nb.colorCode,
        },
      });
    }

    // eslint-disable-next-line no-console
    console.log(`[${loc}] initializeProgress -> PASS notebooks=${progress.size}`);
    return progress;
  }

  /**
   * @function calculateTotalDays
   * @description
   * Produces a conservative upper-bound for the number of days to scan when building the
   * plan. The estimate is intentionally generous to avoid truncation: we compute required
   * block days from total units (chunks of 3) and factor in alternating sets by multiplying
   * by the number of learning sets, then add a safety margin for interleaved sessions
   * (3 × total lessons) spaced every few days. The result ensures O(D) iteration with D
   * large enough to schedule all obligations without recomputation.
   */
  private calculateTotalDays(
    notebooks: NotebookMeta[],
    learningSets: LearningSet[],
    lessonsByNotebook: Map<string, Lesson[]>
  ): number {
    const loc = 'core/StudyPlanOrchestrator.ts#5204';
    let totalUnits = 0;
    let totalLessons = 0;

    for (const nb of notebooks) {
      const lessons = lessonsByNotebook.get(nb.fileId) ?? [];
      totalLessons += lessons.length;
      for (const lesson of lessons) totalUnits += lesson.units.length;
    }

    // Block learning days (each day ≤ 3 units per notebook session).
    const blockChunks = Math.ceil(totalUnits / DEFAULT_CHUNK_SIZE);

    // Each block chunk requires a matching next-day revision; with alternating sets,
    // we approximate by multiplying chunks by 2 and by number of sets.
    const blockAndRevisionDays = blockChunks * 2 * Math.max(1, learningSets.length);

    // Interleaved quota across notebooks: 3 × lessons. Add a liberal spacing window.
    const interleavedAllowance = totalLessons * 3 * 3; // spaced every ~3 days across sets.

    const estimate = Math.max(30, blockAndRevisionDays + interleavedAllowance);
    // eslint-disable-next-line no-console
    console.log(
      `[${loc}] calculateTotalDays -> units=${totalUnits} lessons=${totalLessons} sets=${learningSets.length} days=${estimate}`
    );
    return estimate;
  }

  /**
   * @function buildPlanMetadata
   * @description
   * Builds the summary metadata for the generated/extended segment. End date falls back
   * to the start date if no sessions are emitted. Counts are O(N) over provided sessions.
   */
  private buildPlanMetadata(
    sessions: StudySession[],
    startDate: Date,
    learningSetCount: number
  ): PlanMetadata {
    const loc = 'core/StudyPlanOrchestrator.ts#5205';
    let endDate = startDate;
    let blockLearning = 0;
    let blockRevision = 0;
    let interleavedRevision = 0;

    for (const s of sessions) {
      if (s.date > endDate) endDate = s.date;
      const t = (s as any).type;
      if (t === 'block') blockLearning++;
      else if (t === 'revision-block') blockRevision++;
      else if (t === 'revision-interleaved') interleavedRevision++;
    }

    const meta: PlanMetadata = {
      startDate,
      endDate,
      totalSessions: sessions.length,
      learningSetCount,
      sessionBreakdown: { blockLearning, blockRevision, interleavedRevision },
    };

    // eslint-disable-next-line no-console
    console.log(
      `[${loc}] buildPlanMetadata -> total=${meta.totalSessions} breakdown={block:${blockLearning},rev:${blockRevision},il:${interleavedRevision}}`
    );

    return meta;
    }
}
