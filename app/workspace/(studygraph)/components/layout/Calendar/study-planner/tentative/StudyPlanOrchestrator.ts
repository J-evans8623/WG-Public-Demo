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
  hasBlockOnDate,
} from '@/app/workspace/(studygraph)/components/layout/Calendar/study-planner/core/NotebookAnchorPlanner';


import {
  determineResumePoint,
  truncateFutureSchedule,
  identifyNewContent,
  appendLearningPhase,
  appendMaintenancePhase
} from './UpdateStrategy';
import { BalanceStructuralLoad, EvolveLearningSets, IdentifyMasteryAnchor, IdentifyTemporalAnchor, InferLearningSetPattern, MapAdditiveSessions, MaterializeDelta, MaterializeInterleavedSessions, ReconcileFinalState, SeedMaintenanceProgram, SyncGlobalContext } from './InsertStrategy';

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
   * @function extendPlan_InsertStrategy
   * @description
   * Coordinates the non-destructive insertion pipeline to integrate new notebooks. 
   * * [update - 1004]
   * Integrated the IdentifyMasteryAnchor abstraction to fix the review cadence bug. 
   * Each notebook now receives a unique mastery anchor based on its own first 
   * mastered unit, allowing interleaved review to overlap with learning.
   */
public extendPlan_InsertStrategy(
    existing: StudyPlanState,
    newNotebooks: NotebookMeta[]
  ): StudyPlanOutput {
    const loc = 'core/StudyPlanOrchestrator.ts#extendPlan_InsertStrategy';
    const today = todayMidnightLocal();

    const verifiedNewMetas = new SyncGlobalContext().sync(newNotebooks, existing.notebookProgress);
    if (verifiedNewMetas.length === 0) return { sessions: Array.from(existing.sessionsByDate.values()).flat(), planMetadata: {} as any, state: existing };

    // update - 1305: Structural Evolution Step
    // Rationale: We must unlock LS-B if total notebooks > 3 before projecting the rhythm.
    const evolution = new EvolveLearningSets();
    const evolvedSets = evolution.evolve(existing.learningSets, verifiedNewMetas);

    // update - 1306: Pass evolvedSets to ensure pattern sees Set B
    const futurePattern = new InferLearningSetPattern(this.learningSetFns.buildSchedulePattern).infer(today, evolvedSets, existing.config);
    
    // update - 1307: Pass evolvedSets to ensure balancer can assign to Set B
    const assignments = new BalanceStructuralLoad().balance(verifiedNewMetas, evolvedSets);

    const materializer = new MaterializeDelta(this.lessonFns.parseLessons, this.lessonFns.chunkLesson);
    const mapper = new MapAdditiveSessions();
    const anchorIdentifier = new IdentifyMasteryAnchor();
    const seeder = new SeedMaintenanceProgram();
    const interleavedMaterializer = new MaterializeInterleavedSessions();
    const reconciler = new ReconcileFinalState();

    const allNewSessions: StudySession[] = [];
    const newProgressEntries = new Map<string, NotebookProgress>();

    verifiedNewMetas.forEach(meta => {
      const setId = assignments.get(meta.fileId)!;
      const anchorDate = new IdentifyTemporalAnchor().findAnchor(setId, existing.config, futurePattern, today);
      const contentQueue = materializer.materialize(meta);

      const { newSessions } = mapper.mapSessions(contentQueue, anchorDate, meta, existing.config, futurePattern);
      allNewSessions.push(...newSessions);

      const masteryDate = anchorIdentifier.findMasteryDate(newSessions, meta.fileId);

      const interleavedProgress = seeder.seed(meta.fileId, this.lessonFns.parseLessons(meta).length, masteryDate, setId, futurePattern);
      const interleavedSessions = interleavedMaterializer.materialize(meta.fileId, interleavedProgress, meta);
      allNewSessions.push(...interleavedSessions);
      
      newProgressEntries.set(meta.fileId, {
        notebookId: meta.fileId,
        learningSetId: setId,
        lessonProgress: this.lessonFns.parseLessons(meta).map(l => ({
          lessonId: l.id,
          lessonUnits: l.units,
          totalUnits: l.units.length,
          unitsCoveredInBlockLearning: l.units.length,
          blockLearningSessions: [], 
          blockRevisionSessions: [],
          status: 'completed'
        })),
        interleavedRevisionProgress: interleavedProgress,
        notebookMetaSnapshot: { fileId: meta.fileId, fileName: meta.fileName, colorCode: meta.colorCode }
      });
    });

    // update - 1308: Use evolvedSets in the reconciled state
    const result = reconciler.reconcile({ sessions: [], planMetadata: {} as any, state: { ...existing, learningSets: evolvedSets } } as any, allNewSessions, newProgressEntries);
    return result;
  }

  /**
   * @function extendPlan_InsertionStrategy
   * @description
   * 
   * depracated (dont use)
   * STRATEGY A: INSERTION (The "Current" Logic)
   * Used when adding NEW untracked notebooks.
   * * (new update - separate strategy for inserting new books)
   * * Logic:
   * Uses "Dynamic Per-Day Pending Filter" (Passive Scheduling).
   * It iterates days and checks "Does the active set have pending work?" dynamically.
   * This works best when the state has been reconfigured/reset.

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

    */

/**
   * @function extendPlan_UpdateStrategy
   * @description
   * STRATEGY B: UPDATE (Append-Only / Non-Destructive)
   * Used when adding NEW content to EXISTING notebooks.
   * * Architecture:
   * It uses a linear pipeline of 5 abstractions to:
   * 1. Find a safe resume point (Anchor).
   * 2. Clear the conflicting future.
   * 3. Identify and chunk new content.
   * 4. Append learning blocks sequentially.
   * 5. Append maintenance (interleaved) tail.
   */
  public extendPlan_UpdateStrategy(
    existingPlan: StudyPlanOutput, 
    updatedNotebooks: NotebookMeta[]
  ): StudyPlanOutput {
    const loc = 'core/StudyPlanOrchestrator.ts#UPDATE-APPEND';

    // 1. Setup Context (Prep for Abstractions)
    const { learningSets, notebookProgress: progressMap, sessionsByDate } = existingPlan.state;
    const config = existingPlan.state.config;
    const today = todayMidnightLocal();
    
    // Clone map to allow mutation (Truncation)
    const mergedSessionsByDate = new Map<string, StudySession[]>(sessionsByDate);

    // 2. Parse Lessons & Build Pattern (Prep for Abstractions)
    // We need a schedule pattern that extends into the future to find slots.
    const lessonsByNotebook: Map<string, Lesson[]> = new Map();
    for (const nb of updatedNotebooks) {
      lessonsByNotebook.set(nb.fileId, this.lessonFns.parseLessons(nb));
    }
    
    const schedulePattern = this.learningSetFns.buildSchedulePattern(
      today,
      learningSets,
      config,
      365 // Horizon
    );

    // REMOVED OLD ARTIFACT: reconcileProgressWithLessons was here.
    // It has been moved to the end to prevent "Zero Delta" bug.

    // 4. Execution Loop: Process Each Updated Notebook
    const allNewSessions: StudySession[] = [];

    for (const notebook of updatedNotebooks) {
      const nbId = notebook.fileId;
      
      // Get the existing progress snapshot for COMPARISON (before mutation)
      // If it's a new book, we create a temporary snapshot so logic works.
      let progressSnapshot = progressMap.get(nbId);
      
      if (!progressSnapshot) {
          // This creates a detached progress object just for comparison
          // It effectively says "I have zero history".
          progressSnapshot = {
              notebookId: nbId,
              learningSetId: '', // placeholder, will be fixed by reconcile
              lessonProgress: [],
              interleavedRevisionProgress: { totalRequired: 0, sessionsScheduled: 0, sessionsCompleted: 0, scheduledDates: [], firstSessionDate: undefined }
          };
      }

      // --- ABSTRACTION C: Identify Content ---
      // We identify content FIRST using the OLD snapshot.
      const newChunks = identifyNewContent(
        notebook,
        progressSnapshot, // Old state
        lessonsByNotebook, // New State (from file)
        this.lessonFns.chunkLesson
      );
      
      // Safeguard: Zero Delta
      if (newChunks.length === 0) {
         continue; // Nothing to add for this notebook
      }

      // --- ABSTRACTION A: Resume Point ---
      // We need the Target Set ID. If it's a new book, we might need to look it up 
      // from 'learningSets' directly since 'progressSnapshot' might be empty.
      const targetSetId = progressSnapshot.learningSetId || learningSets.find(ls => ls.notebooks.some(n => n.fileId === nbId))?.id || '';

      const resumePoint = determineResumePoint(
        mergedSessionsByDate,
        nbId,
        learningSets,
        config,
        schedulePattern,
        today
      );

      // --- ABSTRACTION B: Truncate ---
      truncateFutureSchedule(mergedSessionsByDate, nbId, resumePoint);

      // --- ABSTRACTION D: Append Learning ---
      const { newSessions, lastBlockDate } = appendLearningPhase(
        newChunks,
        resumePoint,
        nbId,
        targetSetId,
        config,
        schedulePattern,
        this.blockFns,
        progressMap, // We pass the map, but we use snapshots for metadata
        lessonsByNotebook
      );

      allNewSessions.push(...newSessions);
      
      // Push new sessions to map for completeness before maintenance phase
      newSessions.forEach(s => {
        const k = formatDateKey(s.date);
        const arr = mergedSessionsByDate.get(k) || [];
        arr.push(s);
        mergedSessionsByDate.set(k, arr);
      });

      // --- ABSTRACTION E: Append Maintenance ---
      const totalLessons = lessonsByNotebook.get(nbId)?.length || 0;
      
      const maintenanceSessions = appendMaintenancePhase(
        nbId,
        progressSnapshot, // Use snapshot for metadata
        totalLessons,
        lastBlockDate, // Start after the learning we just added
        mergedSessionsByDate,
        config,
        schedulePattern,
        targetSetId
      );

      allNewSessions.push(...maintenanceSessions);
      
      // Push maintenance sessions to map as well
      maintenanceSessions.forEach(s => {
        const k = formatDateKey(s.date);
        const arr = mergedSessionsByDate.get(k) || [];
        arr.push(s);
        mergedSessionsByDate.set(k, arr);
      });
    }

    // --- RECONCILE STEP (MOVED) ---
    // Now that we have scheduled everything based on the delta, we update the
    // progress map to include the new lessons. This ensures the "Save State"
    // is correct for the next time the user loads the app.
    this.reconcileProgressWithLessons(progressMap, lessonsByNotebook, schedulePattern);

    // 5. Final Assembly
    const outSessions: StudySession[] = [];
    
    // Track earliest date during flattening (O(N) operation we are doing anyway)
    let earliestSessionDate: Date | null = null;

    for (const sessions of mergedSessionsByDate.values()) {
      outSessions.push(...sessions);
      
      // Contingency Scan: Find the true start of the schedule
      if (sessions.length > 0) {
        // Assuming sessions in bucket are sorted or same-day; checking first is sufficient per-bucket
        const bucketDate = sessions[0].date;
        if (!earliestSessionDate || bucketDate < earliestSessionDate) {
          earliestSessionDate = bucketDate;
        }
      }
    }

    // --- CONTINGENCY LOGIC ---
    const effectiveStartDate = existingPlan.planMetadata?.startDate 
      ?? earliestSessionDate 
      ?? today;

    const planMetadata = this.buildPlanMetadata(
        outSessions, 
        effectiveStartDate, 
        learningSets.length
    );
    
    const newState: StudyPlanState = {
      learningSets,
      notebookProgress: progressMap,
      sessionsByDate: mergedSessionsByDate,
      nextAvailableDate: addDays(today, 30),
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