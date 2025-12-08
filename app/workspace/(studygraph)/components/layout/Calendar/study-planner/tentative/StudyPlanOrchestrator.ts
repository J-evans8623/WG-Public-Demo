/**
 * @file core/StudyPlanOrchestrator.ts
 * @description
 * [Responsibility & Scope]
 * The Orchestrator is the central "brain" of the scheduling algorithm. It coordinates 
 * the transformation of Notebook metadata into specific StudySessions.
 * * This module has been refactored to support two distinct extension strategies:
 * 1. Insertion Strategy: For adding new, untracked notebooks (Passive Scheduling).
 * 2. Update Strategy: For updating existing notebooks with new lessons (Active Anchoring).
 * * It relies on injected dependencies for low-level tasks (parsing, chunking) to maintain 
 * testability and separation of concerns.
 */

import type {
  StudySession,
  NotebookMeta,
} from '@/app/Library/Definitions/CalendarDefinitions';
import type { ScheduleConfig } from '../models/Configuration';
import type { StudyPlanOutput, StudyPlanState, PlanMetadata } from '../models/StudyPlanOutput';
import type { LearningSet } from '../models/LearningSet';
import type { NotebookProgress, LessonProgress } from '../models/Progress';
import type { Lesson, LessonChunk } from '../models/Lesson';

import { DEFAULT_CHUNK_SIZE, INTERLEAVED_REVISION_MULTIPLIER, INTERLEAVED_INTERVAL_DAYS } from '../constants/schedulingConstants';
import { addDays, formatDateKey, isDateAvailable } from '../utils/dateUtils';
import {
  hasPendingLearning,
  findNextEligibleLearningSetDay,
  makeSyntheticSetForNotebooks,
} from '@/app/workspace/(studygraph)/components/layout/Calendar/study-planner/core/NotebookAnchorPlanner';

// --- Dependency Contracts -------------------------

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

/**
 * Helper to normalize dates to local midnight to prevent time-drift issues.
 */
function todayMidnightLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// --- Orchestrator Class ----------------------------------------------------------

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
   * Generates a brand new study plan from scratch.
   * Steps: Parse -> Distribute -> Initialize Progress -> Schedule Pattern -> Day Loop.
   */
  public generatePlan(
    notebooks: NotebookMeta[],
    config: ScheduleConfig,
    startDate: Date
  ): StudyPlanOutput {
    const loc = 'core/StudyPlanOrchestrator.ts#5201';

    // 1. Parse lessons
    const lessonsByNotebook: Map<string, Lesson[]> = new Map();
    for (const nb of notebooks) {
      const lessons = this.lessonFns.parseLessons(nb);
      lessonsByNotebook.set(nb.fileId, lessons);
    }

    // 2. Distribute into Learning Sets
    const learningSets = this.learningSetFns.distribute(notebooks);

    // 3. Initialize Progress Tracking
    const progressMap = this.initializeProgress(notebooks, learningSets, lessonsByNotebook);

    // 4. Build Schedule Pattern
    const totalDays = this.calculateTotalDays(notebooks, learningSets, lessonsByNotebook);
    const schedulePattern = this.learningSetFns.buildSchedulePattern(
      startDate,
      learningSets,
      config,
      totalDays
    );

    // 5. Execution Loop
    const sessionsByDate = new Map<string, StudySession[]>();
    const allSessions: StudySession[] = [];
    let prevDaySessions: StudySession[] = [];
    let prevActiveSet: LearningSet | undefined;

    for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
      const currentDate = addDays(startDate, dayOffset);
      if (!isDateAvailable(currentDate, config)) continue;

      const key = formatDateKey(currentDate);
      const activeSet = schedulePattern.get(key);

      // Schedule Blocks
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

      // Handle Completions & Interleaved
      const completedLessons = this.completionFns.detectCompletions(progressMap, currentDate);
      const interleaved = this.completionFns.scheduleInterleavedRevisions(
        completedLessons,
        progressMap,
        currentDate,
        schedulePattern,
        lessonsByNotebook
      );

      // Aggregate
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

      prevDaySessions = daySessions;
      prevActiveSet = activeSet;
    }

    const planMetadata = this.buildPlanMetadata(allSessions, startDate, learningSets.length);
    const state: StudyPlanState = {
      learningSets,
      notebookProgress: progressMap,
      sessionsByDate,
      nextAvailableDate: addDays(startDate, totalDays),
      config,
    };


    return { sessions: allSessions, planMetadata, state };
  }

  /**
   * @function extendPlan_InsertionStrategy
   * @description
   * STRATEGY A: INSERTION (The "Current" Logic)
   * Used when adding NEW untracked notebooks.
   * * (new update - separate strategy for inserting new books)
   * * Logic:
   * Uses "Dynamic Per-Day Pending Filter" (Passive Scheduling).
   * It iterates days and checks "Does the active set have pending work?" dynamically.
   * This works best when the state has been reconfigured/reset.
   */
  public extendPlan_InsertionStrategy(
      existing: StudyPlanState,
      updatedNotebooks: NotebookMeta[]
    ): StudyPlanOutput {
      const loc = 'core/StudyPlanOrchestrator.ts#6202';
  
      // 1) Rebuild lessons map from updated notebooks.
      const lessonsByNotebook: Map<string, Lesson[]> = new Map();
      for (const nb of updatedNotebooks) {
        const lessons = this.lessonFns.parseLessons(nb);
        lessonsByNotebook.set(nb.fileId, lessons);
      }
  
      // 2) Reuse plan state.
      const { learningSets, notebookProgress: progressMap, sessionsByDate } = existing;
      const config = existing.config;
  
      // 3) Anchor extension window at today's local midnight.
      const startDate = todayMidnightLocal();
  
      // 4) Build forward schedule window and pattern.
      const totalDays = this.calculateTotalDays(
        updatedNotebooks,
        learningSets,
        lessonsByNotebook
      );
      const schedulePattern = this.learningSetFns.buildSchedulePattern(
        startDate,
        learningSets,
        config,
        totalDays
      );
  
      // 5) Reconcile progress with new lessons (and adjust interleaved program as needed).
      this.reconcileProgressWithLessons(progressMap, lessonsByNotebook, schedulePattern);
  
      // 6) Day loop with **dynamic per-day pending filter**.
      //    (new update - dynamic daily anchors)
      const outSessions: StudySession[] = [];
      const mergedSessionsByDate = new Map<string, StudySession[]>(sessionsByDate);
      let prevDaySessions: StudySession[] = [];
      let prevActiveSet: LearningSet | undefined;
  
      for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
        const currentDate = addDays(startDate, dayOffset);
        if (!isDateAvailable(currentDate, config)) continue;
  
        const key = formatDateKey(currentDate);
        const scheduledSet = schedulePattern.get(key) || undefined;
  
        // 6a) Compute which notebooks in the scheduled set still have pending learning.
        let blockLearning: StudySession[] = [];
        let effectiveAnchorNotebookIds: string[] = [];
  
        if (scheduledSet) {
          const pendingIds = scheduledSet.notebooks
            .filter((nb) => hasPendingLearning(progressMap.get(nb.fileId)))
            .map((nb) => nb.fileId);
  
          if (pendingIds.length > 0) {
            const synthetic = makeSyntheticSetForNotebooks(scheduledSet, pendingIds);
            blockLearning = this.blockFns.scheduleBlockLearning(
              currentDate,
              synthetic,
              progressMap,
              lessonsByNotebook
            );
            effectiveAnchorNotebookIds = pendingIds;

          }
        }
  
        // 6b) DEBUG guard: spot days where a learning set is active but no blocks are created
        //     even though notebooks are still pending. This should now indicate a *real*
        //     scheduling anomaly rather than the former anchor starvation.
        if (scheduledSet) {
          const pendingInSet = scheduledSet.notebooks.filter((nb) =>
            hasPendingLearning(progressMap.get(nb.fileId))
          );
          const hasAnchorToday = effectiveAnchorNotebookIds.length > 0;
          const createdBlocksCount = blockLearning.length;
  
          if (pendingInSet.length > 0 && createdBlocksCount === 0) {
            // eslint-disable-next-line no-console
            console.warn(
              `[${loc}] WARN-SPARSE date=${key} set=${scheduledSet.id}` +
                ` pendingNotebooks=${pendingInSet.length}` +
                ` hasAnchorToday=${hasAnchorToday}` +
                ` (pending notebooks but no new blocks scheduled) [6205]`
            );
          }
        }
  
        // 6c) Mirror yesterday’s learning into block revisions (unchanged).
        const blockRevision = this.blockFns.scheduleBlockRevision(
          currentDate,
          prevDaySessions,
          progressMap,
          scheduledSet,
          prevActiveSet
        );
  
        // 6d) Detect completions and schedule interleaved (unchanged).
        const completed = this.completionFns.detectCompletions(progressMap, currentDate);
        const interleaved = this.completionFns.scheduleInterleavedRevisions(
          completed,
          progressMap,
          currentDate,
          schedulePattern,
          lessonsByNotebook
        );
  
        // 6e) Aggregate and merge into archive.
        const daySessions = this.aggregationFns.aggregateSessions(
          currentDate,
          blockLearning,
          blockRevision,
          interleaved
        );
  
        if (daySessions.length > 0) {
          const prev = mergedSessionsByDate.get(key) ?? [];
          mergedSessionsByDate.set(key, [...prev, ...daySessions]);
          outSessions.push(...daySessions);
        }
  
        prevDaySessions = daySessions;
        prevActiveSet = scheduledSet;
      }
  
      const planMetadata = this.buildPlanMetadata(outSessions, startDate, learningSets.length);
  
      const newState: StudyPlanState = {
        learningSets,
        notebookProgress: progressMap,
        sessionsByDate: mergedSessionsByDate,
        nextAvailableDate: addDays(startDate, totalDays),
        config,
      };
  
      return {
        sessions: outSessions,
        planMetadata,
        state: newState,
      };
    }

  /**
   * @function extendPlan_UpdateStrategy
   * @description
   * STRATEGY B: UPDATE (The "Original" Logic)
   * Used when updating EXISTING notebooks.
   * * (new update - separate strategy to restore active anchoring)
   * * Logic:
   * Uses "Anchor Date Planning" (Active Scheduling).
   * It pre-calculates the `NextEligibleDay` for every updated notebook.
   * This forces the scheduler to create sessions on specific dates, ensuring
   * updates are not missed even if the current day belongs to a different Learning Set.
   */
  public extendPlan_UpdateStrategy(
    existing: StudyPlanState,
    updatedNotebooks: NotebookMeta[]
  ): StudyPlanOutput {
    const loc = 'core/StudyPlanOrchestrator.ts#UPDATE';

    // 1. Parse Updated Lessons
    const lessonsByNotebook: Map<string, Lesson[]> = new Map();
    for (const nb of updatedNotebooks) {
      const lessons = this.lessonFns.parseLessons(nb);
      lessonsByNotebook.set(nb.fileId, lessons);
    }

    // 2. Setup Context
    const { learningSets, notebookProgress: progressMap, sessionsByDate } = existing;
    const config = existing.config;
    const startDate = todayMidnightLocal();

    // 3. Build Pattern
    const totalDays = this.calculateTotalDays(updatedNotebooks, learningSets, lessonsByNotebook);
    const schedulePattern = this.learningSetFns.buildSchedulePattern(
      startDate,
      learningSets,
      config,
      totalDays
    );

    // 4. Reconcile Progress
    this.reconcileProgressWithLessons(progressMap, lessonsByNotebook, schedulePattern);

    // --- ANCHOR DATE PLANNING (Restored Logic) ---
    
    // (new update - pre-calculate anchors to force scheduling)
    
    // 4a. Map notebookId -> learningSetId
    const setByNotebook = new Map<string, LearningSet>();
    for (const ls of learningSets) {
      for (const nb of ls.notebooks) setByNotebook.set(nb.fileId, ls);
    }

    // 4b. Identify notebooks with pending learning and compute explicit anchor dates
    type AnchorRec = { notebookId: string; anchor: Date | null; set: LearningSet };
    const anchors: AnchorRec[] = [];
    
    for (const [nbId, nbProg] of progressMap.entries()) {
      if (!hasPendingLearning(nbProg)) continue;
      const set = setByNotebook.get(nbId);
      if (!set) continue;

      // ACTIVE ANCHORING: Find the specific next date this notebook is allowed to learn
      const anchor = findNextEligibleLearningSetDay(
        nbId,
        nbProg.learningSetId,
        startDate,
        totalDays,
        schedulePattern,
        sessionsByDate,
        config
      );
      anchors.push({ notebookId: nbId, anchor, set });
    }

    // 4c. Invert anchors: dateKey -> list of notebookIds
    const byDate = new Map<string, { set: LearningSet; notebookIds: string[] }>();
    for (const a of anchors) {
      if (!a.anchor) continue;
      const key = formatDateKey(a.anchor);
      const existingEntry = byDate.get(key);
      if (existingEntry) {
        existingEntry.notebookIds.push(a.notebookId);
      } else {
        byDate.set(key, { set: a.set, notebookIds: [a.notebookId] });
      }
    }

    // 5. Execution Loop (Active Anchors)
    const outSessions: StudySession[] = [];
    const mergedSessionsByDate = new Map<string, StudySession[]>(existing.sessionsByDate);
    let prevDaySessions: StudySession[] = [];
    let prevActiveSet: LearningSet | undefined;

    for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
      const currentDate = addDays(startDate, dayOffset);
      if (!isDateAvailable(currentDate, config)) continue;

      const key = formatDateKey(currentDate);
      const scheduledSet = schedulePattern.get(key) || undefined;

      // Check for Explicit Anchors for today
      let blockLearning: StudySession[] = [];
      const dateAnchors = byDate.get(key);
      
      // If we have an anchor for today, we MUST schedule it
      if (scheduledSet && dateAnchors && dateAnchors.notebookIds.length > 0) {
        const synthetic = makeSyntheticSetForNotebooks(scheduledSet, dateAnchors.notebookIds);
        blockLearning = this.blockFns.scheduleBlockLearning(
          currentDate,
          synthetic,
          progressMap,
          lessonsByNotebook
        );
      }

      const blockRevision = this.blockFns.scheduleBlockRevision(
        currentDate,
        prevDaySessions,
        progressMap,
        scheduledSet,
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
        const prev = mergedSessionsByDate.get(key) ?? [];
        mergedSessionsByDate.set(key, [...prev, ...daySessions]);
        outSessions.push(...daySessions);
      }

      prevDaySessions = daySessions;
      prevActiveSet = scheduledSet;
    }

    const planMetadata = this.buildPlanMetadata(outSessions, startDate, learningSets.length);
    const newState: StudyPlanState = {
      learningSets,
      notebookProgress: progressMap,
      sessionsByDate: mergedSessionsByDate,
      nextAvailableDate: addDays(startDate, totalDays),
      config,
    };


    return { sessions: outSessions, planMetadata, state: newState };
  }

  // --- Internal Helpers (Common to both) ---------------------------------------

  /**
   * Aligns existing NotebookProgress with freshly parsed lessons.
   * If new lessons were added, it expands the interleaved quota.
   */
  private reconcileProgressWithLessons(
    progressMap: Map<string, NotebookProgress>,
    lessonsByNotebook: Map<string, Lesson[]>,
    learningSetSchedule: Map<string, LearningSet>
  ): void {
    const loc = 'core/StudyPlanOrchestrator.ts#5206';
    for (const [nbId, nbProgress] of progressMap.entries()) {
      const parsedLessons = lessonsByNotebook.get(nbId) ?? [];
      const have = new Set(nbProgress.lessonProgress.map(p => p.lessonId));

      // Create missing LessonProgress entries
      for (const lesson of parsedLessons) {
        if (have.has(lesson.id)) continue;
        nbProgress.lessonProgress.push({
          lessonId: lesson.id,
          lessonUnits: lesson.units,
          totalUnits: lesson.units.length,
          unitsCoveredInBlockLearning: 0,
          blockLearningSessions: [],
          blockRevisionSessions: [],
          status: 'not-started',
        });
      }

      // Recompute Quotas
      const totalLessons = parsedLessons.length;
      const newQuota = totalLessons * INTERLEAVED_REVISION_MULTIPLIER;
      const ilp = nbProgress.interleavedRevisionProgress;

      if (newQuota > ilp.totalRequired) {
        const need = newQuota - ilp.totalRequired;
        ilp.totalRequired = newQuota;

        // If program already started, append future dates
        if (ilp.firstSessionDate) {
          const lastPlanned = ilp.scheduledDates?.length
            ? ilp.scheduledDates[ilp.scheduledDates.length - 1]
            : ilp.firstSessionDate;

          const targetSetId = nbProgress.learningSetId;
          let cursor = addDays(lastPlanned, INTERLEAVED_INTERVAL_DAYS);
          const maxAppends = Math.max(need * 20, 60);

          for (let i = 0; i < maxAppends && (ilp.scheduledDates.length < ilp.totalRequired); i++) {
            const key = formatDateKey(cursor);
            const ls = learningSetSchedule.get(key);
            if (ls && ls.id === targetSetId) {
              ilp.scheduledDates.push(cursor);
            }
            cursor = addDays(cursor, INTERLEAVED_INTERVAL_DAYS);
          }
          ilp.sessionsScheduled = ilp.scheduledDates.length;
        }
      }
    }
  }

  /**
   * Initializes the progress map for a fresh plan.
   */
  private initializeProgress(
    notebooks: NotebookMeta[],
    learningSets: LearningSet[],
    lessonsByNotebook: Map<string, Lesson[]>
  ): Map<string, NotebookProgress> {
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
    return progress;
  }

  /**
   * Estimates the total days needed for the plan (conservative upper bound).
   */
  private calculateTotalDays(
    notebooks: NotebookMeta[],
    learningSets: LearningSet[],
    lessonsByNotebook: Map<string, Lesson[]>
  ): number {
    let totalUnits = 0;
    let totalLessons = 0;
    for (const nb of notebooks) {
      const lessons = lessonsByNotebook.get(nb.fileId) ?? [];
      totalLessons += lessons.length;
      for (const lesson of lessons) totalUnits += lesson.units.length;
    }
    const blockChunks = Math.ceil(totalUnits / DEFAULT_CHUNK_SIZE);
    const blockAndRevisionDays = blockChunks * 2 * Math.max(1, learningSets.length);
    const interleavedAllowance = totalLessons * 3 * 3;
    return Math.max(30, blockAndRevisionDays + interleavedAllowance);
  }

  /**
   * Aggregates stats for the resulting plan.
   */
  private buildPlanMetadata(
    sessions: StudySession[],
    startDate: Date,
    learningSetCount: number
  ): PlanMetadata {
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

    return {
      startDate,
      endDate,
      totalSessions: sessions.length,
      learningSetCount,
      sessionBreakdown: { blockLearning, blockRevision, interleavedRevision },
    };
  }
}