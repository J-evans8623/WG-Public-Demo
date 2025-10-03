/**
 * @file CalendarService.ts
 * @description
 *   Enhanced core service class implementing monthly calendar generation with sophisticated learning set distribution,
 *   cyclical scheduling algorithms, and staggered session scheduling for the BloomMap calendar planner system. This service
 *   handles the complex business logic of transforming atomic lesson units into structured 30/31 day calendar layouts using
 *   a multi-phase approach: learning set creation (Phase 1), cyclical day assignment (Phase 2), and staggered revision
 *   scheduling (Phase 3). The staggered scheduling implementation manages temporal relationships between block learning sessions,
 *   revision blocks with +1 day offsets, and interleaved revision sessions with +3 day offsets from completion. The system
 *   tracks lesson completion states across notebooks and learning sets to trigger appropriate revision sequences while
 *   maintaining cyclical distribution patterns. The service integrates with existing Firebase storage patterns and provides
 *   methods for generating comprehensive monthly calendars with proper session type sequencing, temporal distribution
 *   management, and support for dynamic notebook updates while preserving established scheduling patterns and user progress
 *   continuity through sophisticated state tracking and lesson completion monitoring.
 */

import {
  NotebookSummary,
  NotebookMeta,
  StudySession,
  ScheduleConfig,
  LessonUnit,
  CalendarMonth,
  DailyStudyPlan,
} from '@/app/Library/Definitions/CalendarDefinitions';
import { chunkLessonUnits } from '@/app/Library/utils/calendar/lessoUnitExtractor';
import {
  StudyPlan,
  StudyPlanIndex,
  buildInitialPlan,
  extendPlan,
  indexPlan,
  sliceByDateRange,
} from '@/app/src/services/calendar/StudyPlanCore';

/**
 * Learning set structure for managing grouped notebooks in cyclical scheduling.
 * Each learning set contains notebooks that will be studied together on assigned days.
 */
interface LearningSet {
  id: string;
  notebooks: NotebookMeta[];
  totalSessions: number;
  estimatedDuration: number;
}

/**
 * Enhanced session scheduling context for tracking lesson completion and revision timing.
 * Maintains comprehensive state needed for staggered revision scheduling and interleaved session management
 * with detailed tracking of completion states and timing offsets for each notebook and lesson chunk.
 */
interface SessionSchedulingContext {
  completedLessons: Map<string, Set<number>>; // notebookId -> Set of completed chunk indices
  lastRevisionDay: Map<string, Map<number, number>>; // notebookId -> chunkIndex -> day of last revision
  interleaveStartDay: Map<string, number>; // notebookId -> day when interleaved revision starts
  lessonChunkSchedule: Map<string, Map<number, number>>; // notebookId -> chunkIndex -> day scheduled
  pendingRevisions: Map<number, PendingRevision[]>; // day -> pending revision sessions
  interleaveSchedule: Map<string, number[]>; // notebookId -> array of interleave session days
    /** NEW: per-notebook LB progression counter (times this notebook got an LB) */
  perNotebookLbCount: Map<string, number>;

  /** NEW: global lookup for notebook meta by id (lets us materialize RBs regardless of active set) */
  notebookById: Map<string, NotebookMeta>;
}

/**
 * Pending revision session structure for managing scheduled revision sessions.
 * Tracks revision sessions that need to be scheduled on future days with proper timing offsets.
 */
interface PendingRevision {
  notebookId: string;
  chunkIndex: number;
  revisionIndex: number;
  sessionType: 'revision-block' | 'revision-interleaved';
  targetDay: number;
  lessonUnits: LessonUnit[];
}

/**
 * Lesson completion tracking structure for managing completed lesson chunks.
 * Maintains state of lesson completion to trigger appropriate revision scheduling sequences.
 */
interface LessonCompletionState {
  notebookId: string;
  chunkIndex: number;
  completionDay: number;
  totalRevisions: number;
}

export class CalendarService {


  /**
   * Retrieves lightweight notebook summaries for calendar selection interface.
   * Fetches basic metadata without full lesson unit details to optimize initial loading performance.
   */
  async getAvailableNotebooks(): Promise<NotebookSummary[]> {
    console.log('[CalendarService.ts][6001] › Fetching available notebooks for calendar selection');
    
    try {
      // Please use api context here instead
      const response = await fetch('/api/files/list', {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch notebooks: ${response.status}`);
      }
      
      const { ownedFiles } = await response.json();
      console.log('[CalendarService.ts][6002] › Retrieved', ownedFiles.length, 'owned files');
      
      const calculateTotalUnits = (lessonUnitsMeta: any): number => {
        if (!lessonUnitsMeta) {
          return 0;
        }
        
        if (typeof lessonUnitsMeta.totalUnits === 'number') {
          return lessonUnitsMeta.totalUnits;
        }
        
        if (lessonUnitsMeta.unitsByMap && typeof lessonUnitsMeta.unitsByMap === 'object') {
          let total = 0;
          Object.values(lessonUnitsMeta.unitsByMap).forEach((units: any) => {
            if (Array.isArray(units)) {
              total += units.length;
            }
          });
          return total;
        }
        
        return 0;
      };
      
      const notebooks: NotebookSummary[] = ownedFiles
        .map((file: any) => {
          const totalUnits = calculateTotalUnits(file.lessonUnitsMeta);
          return {
            fileId: file.fileId,
            fileName: file.fileName,
            totalUnits,
            lastUpdated: new Date(file.updatedAt),
            hasLessonMeta: !!file.lessonUnitsMeta,
          };
        })
        .filter((notebook: any) => notebook.totalUnits > 0);
      
      console.log('[CalendarService.ts][6003] › Found', notebooks.length, 'notebooks with lesson units');
      return notebooks;
      
    } catch (error) {
      console.error('[CalendarService.ts][6004] › Error fetching available notebooks:', error);
      throw new Error('Failed to load available notebooks');
    }
  }

  /**
   * Loads detailed notebook metadata including full lesson unit arrays for selected notebooks.
   * Fetches complete metadata required for schedule generation with proper error handling.
   */
  async getNotebookDetails(fileIds: string[]): Promise<NotebookMeta[]> {
    console.log('[CalendarService.ts][6005] › Loading detailed metadata for', fileIds.length, 'notebooks');
    
    if (fileIds.length === 0) {
      console.warn('[CalendarService.ts][6006] › No file IDs provided for notebook details');
      return [];
    }
    // We need to implement a check cache first logic then fall back to network call...
    try {
      const response = await fetch('/api/calendar/notebook-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileIds }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch notebook details: ${response.status}`);
      }
      
      const { notebooks } = await response.json();
      console.log('[CalendarService.ts][6007] › Received detailed metadata for', notebooks.length, 'notebooks');
      
      const validNotebooks: NotebookMeta[] = notebooks
        .filter((nb: any) => nb.lessonUnits && nb.lessonUnits.length > 0)
        .map((nb: any) => ({
          fileId: nb.fileId,
          filePath: nb.filePath,
          fileName: nb.fileName,
          lessonUnits: nb.lessonUnits,
          lastUpdated: new Date(nb.lastUpdated),
          version: nb.version,
        }));
      
      console.log('[CalendarService.ts][6008] › Validated', validNotebooks.length, 'notebooks for scheduling');
      return validNotebooks;
      
    } catch (error) {
      console.error('[CalendarService.ts][6009] › Error loading notebook details:', error);
      throw new Error('Failed to load notebook details');
    }
  }


  /**
 * @method generateStudyPlan
 * @purpose
 *   Build a canonical StudyPlan with a rolling horizon and deterministic IDs.
 * @steps
 *   1) Use this.generateMonthlyCalendar as the month-level strategy.
 *   2) Delegate to StudyPlanCore.buildInitialPlan (injects stable IDs).
 *   3) Return { plan, planIndex } for persistence + O(1) lookups.
 */
// update - 11
public async generateStudyPlan(params: {
  notebooks: NotebookMeta[];
  config: ScheduleConfig;
  anchor: Date;
  horizonDays: number;
}): Promise<{ plan: StudyPlan; planIndex: StudyPlanIndex }> {
  const plan = await buildInitialPlan({
    anchorDate: params.anchor,
    horizonDays: params.horizonDays,
    notebooks: params.notebooks,
    config: params.config,
    // Use an arrow to preserve `this`
    strategy: async (nb, cfg, targetDate) => {
      const month = await this.generateMonthlyCalendar(nb, cfg, targetDate);
      return month.dailyPlans; // StudyPlanCore expects an array of DailyStudyPlan
    },
  });

  return { plan, planIndex: indexPlan(plan) };
}

/**
 * @method extendStudyPlan
 * @purpose
 *   Append-only plan growth beyond the last planned day; never edits history.
 * @steps
 *   1) Use this.generateMonthlyCalendar as the month-level strategy.
 *   2) Delegate to StudyPlanCore.extendPlan.
 *   3) Return { plan, planIndex }.
 */
// update - 11
public async extendStudyPlan(params: {
  plan: StudyPlan;
  notebooks: NotebookMeta[];
  config: ScheduleConfig;
  horizonDays: number;
}): Promise<{ plan: StudyPlan; planIndex: StudyPlanIndex }> {
  const newPlan = await extendPlan({
    basePlan: params.plan,
    notebooks: params.notebooks,
    config: params.config,
    horizonDays: params.horizonDays,
    strategy: async (nb, cfg, targetDate) => {
      const month = await this.generateMonthlyCalendar(nb, cfg, targetDate);
      return month.dailyPlans;
    },
  });

  return { plan: newPlan, planIndex: indexPlan(newPlan) };
}
  
/**
 * @method generateMonthlyCalendar
 * @purpose
 *   Produce one month of DailyStudyPlan using existing LS/RB/ILR behavior.
 * @steps
 *   1) Guard empty input → return createEmptyMonth(targetDate).
 *   2) Build learning sets (Phase 1).
 *   3) Generate staggered schedule (Phase 2 & 3).
 *   4) Calculate monthly summary and return CalendarMonth.
 */
// update - 11
public async generateMonthlyCalendar(
  notebooks: NotebookMeta[],
  config: ScheduleConfig,
  targetDate: Date
): Promise<CalendarMonth> {
  if (!notebooks || notebooks.length === 0) {
    return this.createEmptyMonth(targetDate);
  }

  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const startDay = targetDate.getDate();

  // 2) Phase 1
  const learningSets = this.createLearningSets(notebooks, config);

  // 3) Phase 2 & 3
  const dailyPlans = this.generateStaggeredSchedule(
    learningSets,
    config,
    year,
    month,
    startDay
  );

  // 4) Summary
  const monthlySummary = this.calculateMonthlySummary(dailyPlans, notebooks);

  return {
    year,
    month,
    dailyPlans,
    monthlySummary,
  };
}


  /**
   * Phase 1: Creates learning sets by grouping notebooks using ceiling division algorithm.
   * Each learning set contains notebooks that will be studied together on specific days,
   * ensuring balanced distribution across all available study periods.
   */
  private createLearningSets(notebooks: NotebookMeta[], config: ScheduleConfig): LearningSet[] {
    console.log('[CalendarService.ts][6015] › Phase 1: Creating learning sets for', notebooks.length, 'notebooks with', config.subjectsPerDay, 'subjects per day');
    
    const numberOfSets = Math.ceil(notebooks.length / config.subjectsPerDay);
    console.log('[CalendarService.ts][6016] › Calculated', numberOfSets, 'learning sets needed');
    
    const learningSets: LearningSet[] = [];
    
    for (let setIndex = 0; setIndex < numberOfSets; setIndex++) {
      const setNotebooks: NotebookMeta[] = [];
      let totalSessions = 0;
      let estimatedDuration = 0;
      
      for (let subjectIndex = 0; subjectIndex < config.subjectsPerDay; subjectIndex++) {
        const notebookIndex = setIndex * config.subjectsPerDay + subjectIndex;
        
        if (notebookIndex < notebooks.length) {
          const notebook = notebooks[notebookIndex];
          setNotebooks.push(notebook);
          
          const sessionChunks = Math.ceil(notebook.lessonUnits.length / config.unitsPerBlockSession);
          const notebookSessions = sessionChunks * (1 + config.revisionsPerLesson);
          totalSessions += notebookSessions;
          estimatedDuration += notebookSessions * 30;
        }
      }
      
      if (setNotebooks.length > 0) {
        const learningSet: LearningSet = {
          id: `set-${String.fromCharCode(65 + setIndex)}`,
          notebooks: setNotebooks,
          totalSessions,
          estimatedDuration,
        };
        
        learningSets.push(learningSet);
        console.log('[CalendarService.ts][6017] › Created learning set', learningSet.id, 'with', setNotebooks.length, 'notebooks,', totalSessions, 'total sessions');
      }
    }
    
    console.log('[CalendarService.ts][6018] › Phase 1 complete: Created', learningSets.length, 'learning sets');
    return learningSets;
  }

  /**
   * Phase 2 & 3: Generates cyclical schedule with staggered session scheduling implementation.
   * Combines cyclical learning set assignment with sophisticated revision timing management,
   * implementing +1 day offsets for revision blocks and +3 day offsets for interleaved sessions.
   */

private generateStaggeredSchedule(
  learningSets: LearningSet[],
  config: ScheduleConfig,
  year: number,
  month: number,
  startDay: number = 1
): DailyStudyPlan[] {
  console.log('[CalendarService.ts][6019] › Phase 2&3: Generating staggered schedule with', learningSets.length, 'learning sets');

  const dailyPlans: DailyStudyPlan[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // ── 1) Build scheduling context with global notebook lookup + counters
  const context: SessionSchedulingContext = {
    completedLessons: new Map(),
    lastRevisionDay: new Map(),
    interleaveStartDay: new Map(),
    lessonChunkSchedule: new Map(),
    pendingRevisions: new Map(),
    interleaveSchedule: new Map(),

    // NEW
    perNotebookLbCount: new Map(),
    notebookById: new Map(),
  };

  // ── 2) Preload context maps for every notebook across all learning sets
  for (const set of learningSets) {
    for (const nb of set.notebooks) {
      context.completedLessons.set(nb.fileId, new Set());
      context.lastRevisionDay.set(nb.fileId, new Map());
      context.lessonChunkSchedule.set(nb.fileId, new Map());
      context.interleaveSchedule.set(nb.fileId, []);
      context.perNotebookLbCount.set(nb.fileId, 0); // NEW
      context.notebookById.set(nb.fileId, nb);      // NEW
    }
  }

  let studyDayCounter = 0;
  const isSingleSetMode = learningSets.length < 2;

  // ── 3) First pass: schedule LBs (and enqueue RB/ILR windows) day-by-day
  for (let day = startDay; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);
    const dow = currentDate.getDay();

    // 3.1 Respect allowed weekdays
    if (!config.daysPerWeek.includes(dow)) continue;

    // 3.2 Choose set by cycle (okay even in single-set)
    const learningSetIndex = studyDayCounter % learningSets.length;
    const assignedSet = learningSets[learningSetIndex];

    // 3.3 SINGLE-SET SPACING:
    //     If there's effectively one set, we alternate LB days and RB-only days.
    //     - Even studyDayCounter: LB day (schedule blocks)
    //     - Odd  studyDayCounter: RB-only day (do not schedule new LBs)
    const isRbOnlyDay = isSingleSetMode && (studyDayCounter % 2 === 1);

    if (!isRbOnlyDay) {
      // 3.4 Schedule block LBs for this set; enqueue RBs(+1) and ILR(+3 after last RB)
      this.scheduleBlockLearningWithRevisions(
        assignedSet,
        studyDayCounter,
        day,
        config,
        context
      );
    }

    studyDayCounter++;
  }

  // ── 4) Second pass: materialize day objects (LBs + all pending RBs/ILRs)
  studyDayCounter = 0;
  for (let day = startDay; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);
    const dow = currentDate.getDay();
    if (!config.daysPerWeek.includes(dow)) continue;

    const learningSetIndex = studyDayCounter % learningSets.length;
    const assignedSet = learningSets[learningSetIndex];

    const dailyPlan = this.createStaggeredDailyPlan(
      currentDate,
      assignedSet,
      config,
      studyDayCounter,
      day,
      context
    );

    dailyPlans.push(dailyPlan);
    studyDayCounter++;
  }

  return dailyPlans;
}


/**
 * Schedules block learning sessions and plans corresponding revision sequences with proper timing offsets.
 * Implements the core staggered scheduling logic by tracking lesson chunk progression and scheduling
 * revision blocks with +1 day offsets and interleaved sessions with +3 day offsets from completion.
 */
private scheduleBlockLearningWithRevisions(
  learningSet: LearningSet,
  studyDayIndex: number,
  currentDay: number,
  config: ScheduleConfig,
  context: SessionSchedulingContext
): void {
  console.log('[CalendarService.ts][6023] › Scheduling block learning and revisions for day', currentDay, 'study index', studyDayIndex);

  // Step 1: For each notebook in the set, determine its next chunk via per-notebook LB count
  for (const notebook of learningSet.notebooks) {
    const sessionChunks = chunkLessonUnits(notebook.lessonUnits, config.unitsPerBlockSession);
    const notebookSchedule = context.lessonChunkSchedule.get(notebook.fileId)!;
    const revisionSchedule = context.lastRevisionDay.get(notebook.fileId)!;

    // 1.1 Determine next chunk index for this notebook:
    //     Use the per-notebook LB progression counter (decoupled from set size)
    const lbCount = context.perNotebookLbCount.get(notebook.fileId) ?? 0;
    const chunkIndex = lbCount;

    // 1.2 Stop if we’ve exhausted all chunks for this notebook
    if (chunkIndex >= sessionChunks.length) continue;

    const targetChunk = sessionChunks[chunkIndex];

    // Step 2: Record that this chunk is learned today
    notebookSchedule.set(chunkIndex, currentDay);
    context.perNotebookLbCount.set(notebook.fileId, lbCount + 1);

    console.log('[CalendarService.ts][6024] › Scheduling chunk', chunkIndex, 'for notebook', notebook.fileName, 'on day', currentDay);

    // Step 3: Enqueue RBs at day+1, day+2, ... depending on revisionsPerLesson
    for (let revisionIndex = 0; revisionIndex < config.revisionsPerLesson; revisionIndex++) {
      const revisionDay = currentDay + 1 + revisionIndex;

      if (!context.pendingRevisions.has(revisionDay)) {
        context.pendingRevisions.set(revisionDay, []);
      }

      context.pendingRevisions.get(revisionDay)!.push({
        notebookId: notebook.fileId,
        chunkIndex,
        revisionIndex,
        sessionType: 'revision-block',
        targetDay: revisionDay,
        lessonUnits: targetChunk, // exact LB units carried forward
      });

      // Track the last RB day for this chunk (used to anchor ILR later)
      revisionSchedule.set(chunkIndex, revisionDay);

      console.log('[CalendarService.ts][6025] › Scheduled revision', revisionIndex, 'for chunk', chunkIndex, 'on day', revisionDay);
    }

    // Step 4: If this was the final chunk, schedule ILR starting +3 days after the last RB
    if (chunkIndex === sessionChunks.length - 1) {
      // 4.1 Compute last RB day over all chunks in this notebook
      const lastRevisionDay = Math.max(...Array.from(revisionSchedule.values()));
      const interleaveStartDay = lastRevisionDay + 3;
      context.interleaveStartDay.set(notebook.fileId, interleaveStartDay);

      // 4.2 Count = 3 × number of chunks (existing rule)
      const interleaveCount = sessionChunks.length * 3;
      const ilrDays = context.interleaveSchedule.get(notebook.fileId)!;

      for (let i = 0; i < interleaveCount; i++) {
        const interleaveDay = interleaveStartDay + (i * 3);
        ilrDays.push(interleaveDay);

        if (!context.pendingRevisions.has(interleaveDay)) {
          context.pendingRevisions.set(interleaveDay, []);
        }

        context.pendingRevisions.get(interleaveDay)!.push({
          notebookId: notebook.fileId,
          chunkIndex: -1, // sentinel for ILR
          revisionIndex: i,
          sessionType: 'revision-interleaved',
          targetDay: interleaveDay,
          lessonUnits: [], // ILR uses all notebook lessons in the session creator
        });

        console.log('[CalendarService.ts][6026] › Scheduled interleaved session', i, 'for notebook', notebook.fileName, 'on day', interleaveDay);
      }
    }
  }
}

/**
 * Creates comprehensive daily study plan incorporating block learning sessions, revision blocks,
 * and interleaved sessions based on staggered scheduling algorithm. Combines multiple session types
 * on each day according to the calculated revision timing and lesson completion sequences.
 */
private createStaggeredDailyPlan(
  date: Date,
  learningSet: LearningSet,
  config: ScheduleConfig,
  studyDayIndex: number,
  currentDay: number,
  context: SessionSchedulingContext
): DailyStudyPlan {
  console.log('[CalendarService.ts][6027] › Creating staggered daily plan for', date.toDateString(), 'day', currentDay);

  const sessions: StudySession[] = [];
  let totalDuration = 0;
  const subjectSummary: any = {};

  // Step 1: Add LBs that are scheduled for today (unchanged behavior)
  learningSet.notebooks.forEach((notebook, notebookIndex) => {
    const sessionChunks = chunkLessonUnits(notebook.lessonUnits, config.unitsPerBlockSession);
    const notebookSchedule = context.lessonChunkSchedule.get(notebook.fileId)!;

    for (const [chunkIndex, scheduledDay] of notebookSchedule.entries()) {
      if (scheduledDay === currentDay) {
        const targetChunk = sessionChunks[chunkIndex];

        const session = this.createBlockSession(
          notebook,
          targetChunk,
          date,
          `block-${notebook.fileId}-${chunkIndex}-${currentDay}`
        );

        session.timeSlot = config.preferredTimeSlots[notebookIndex % config.preferredTimeSlots.length];
        sessions.push(session);
        totalDuration += session.metadata.estimatedDuration;

        this.updateSubjectSummary(subjectSummary, notebook, 1, targetChunk.length, notebookIndex);
        console.log('[CalendarService.ts][6028] › Added block learning session for', notebook.fileName, 'chunk', chunkIndex);
        break;
      }
    }
  });

  // Step 2: Add ALL pending revisions for today (UNSCOPED to the active learning set)
  const pendingRevisions = context.pendingRevisions.get(currentDay) || [];
  let revisionSessionCount = 0;

  for (const revision of pendingRevisions) {
    // 2.1 Resolve notebook meta globally (do not restrict to today's set)
    const notebook = context.notebookById.get(revision.notebookId);
    if (!notebook) continue;

    let session: StudySession;

    // 2.2 Create the correct session type
    if (revision.sessionType === 'revision-interleaved') {
      session = this.createInterleavedRevisionSession(
        notebook,
        date,
        `interleaved-${revision.notebookId}-${revision.revisionIndex}-${currentDay}`
      );
    } else {
      session = this.createRevisionBlockSession(
        notebook,
        revision.lessonUnits, // exact LB units
        date,
        `revision-${revision.notebookId}-${revision.chunkIndex}-${revision.revisionIndex}-${currentDay}`
      );
    }

    // 2.3 Assign a time slot that follows after the LBs added above
    const baseTimeSlotIndex = sessions.length % config.preferredTimeSlots.length;
    session.timeSlot = config.preferredTimeSlots[baseTimeSlotIndex];

    // 2.4 Aggregate
    sessions.push(session);
    totalDuration += session.metadata.estimatedDuration;

    // Note: For ILR we pass unitCount based on session internals; here we use lessonUnits length for RBs
    this.updateSubjectSummary(
      subjectSummary,
      notebook,
      1,
      revision.lessonUnits.length,
      revisionSessionCount
    );

    revisionSessionCount++;
    console.log('[CalendarService.ts][6029] › Added', revision.sessionType, 'session for', notebook.fileName);
  }

  console.log('[CalendarService.ts][6030] › Created daily plan with', sessions.length, 'total sessions, duration:', totalDuration, 'minutes');

  return {
    date: new Date(date),
    sessions,
    subjectSummary,
    totalDuration,
    completedSessions: [],
  };
}


  /**
   * Creates a block-style study session for initial learning of lesson unit content.
   * Generates comprehensive session metadata including timing estimates and topic coverage.
   */
  private createBlockSession(
    notebook: NotebookMeta,
    unitChunk: LessonUnit[],
    date: Date,
    sessionId: string
  ): StudySession {
    const topicTitles = unitChunk.map(unit => unit.conceptNodeTitle);
    const sessionTitle =  unitChunk[0].parentTitle;
    const estimatedDuration = unitChunk.length * 15;
    
    return {
      id: sessionId,
      date: new Date(date),
      notebookMeta: notebook,
      targetLessonUnits: unitChunk,
      type: 'block',
      sessionConfig: {
        unitCount: unitChunk.length,
      },
      metadata: {
        sessionTitle,
        estimatedDuration,
        topicTitles,
      },
    };
  }

  /**
   * Creates a revision block session for reviewing specific lesson unit chunks with targeted practice.
   * Focuses on reinforcement of previously learned content through flashcards and targeted exercises
   * for the specific lesson units that were completed in earlier block learning sessions.
   */
  private createRevisionBlockSession(
    notebook: NotebookMeta,
    unitChunk: LessonUnit[],
    date: Date,
    sessionId: string
  ): StudySession {
    const topicTitles = unitChunk.map(unit => unit.conceptNodeTitle);
    const sessionTitle = unitChunk[0].parentTitle;
    const estimatedDuration = unitChunk.length * 10; // Shorter duration for revision
    
    return {
      id: sessionId,
      date: new Date(date),
      notebookMeta: notebook,
      targetLessonUnits: unitChunk,
      type: 'revision-block',
      sessionConfig: {
        unitCount: unitChunk.length,
      },
      metadata: {
        sessionTitle,
        estimatedDuration,
        topicTitles,
      },
    };
  }

  /**
   * Creates an interleaved revision session for mixed practice across all notebook lessons.
   * Implements spaced repetition by mixing flashcards and quizzes from various lessons within
   * the notebook to strengthen long-term retention through varied practice and retrieval.
   */
  private createInterleavedRevisionSession(
    notebook: NotebookMeta,
    date: Date,
    sessionId: string
  ): StudySession {
    const sessionTitle = `Mixed Review: ${notebook.fileName}`;
    const estimatedDuration = 20; // Fixed duration for interleaved sessions
    const topicTitles = notebook.lessonUnits.map(unit => unit.conceptNodeTitle).slice(0, 3);
    
    return {
      id: sessionId,
      date: new Date(date),
      notebookMeta: notebook,
      targetLessonUnits: notebook.lessonUnits, // Use all lesson units for interleaved
      type: 'revision-interleaved',
      sessionConfig: {
        unitCount: notebook.lessonUnits.length,
      },
      metadata: {
        sessionTitle,
        estimatedDuration,
        topicTitles,
      },
    };
  }

  /**
   * Updates subject summary with session information for daily plan metadata.
   * Maintains comprehensive tracking of subject distribution and session counts for calendar display.
   */
  private updateSubjectSummary(
    subjectSummary: any,
    notebook: NotebookMeta,
    sessionCount: number,
    unitCount: number,
    colorIndex: number
  ): void {
    if (!subjectSummary[notebook.fileId]) {
      subjectSummary[notebook.fileId] = {
        notebookName: notebook.fileName,
        sessionCount: 0,
        totalUnits: 0,
        color: notebook.color || this.getDefaultColor(colorIndex),
      };
    }
    
    subjectSummary[notebook.fileId].sessionCount += sessionCount;
    subjectSummary[notebook.fileId].totalUnits += unitCount;
  }

/**
 * Helper method to find notebook within a specific learning set by notebook ID.
 * Provides efficient lookup for revision session creation with proper type safety.
 */
private findNotebookInLearningSet(learningSet: LearningSet, notebookId: string): NotebookMeta | undefined {
  return learningSet.notebooks.find(notebook => notebook.fileId === notebookId);
}

/**
 * Helper method to find notebook across multiple learning sets by notebook ID.
 * Provides efficient lookup for revision session creation when notebooks span multiple learning sets.
 */
private findNotebookInLearningSets(learningSets: LearningSet[], notebookId: string): NotebookMeta | undefined {
  for (const learningSet of learningSets) {
    const found = learningSet.notebooks.find(nb => nb.fileId === notebookId);
    if (found) {
      return found;
    }
  }
  return undefined;
}
  /**
   * Gets default color for notebook visual distinction in calendar display.
   * Provides consistent color assignment based on notebook index for visual clarity.
   */
  private getDefaultColor(index: number): string {
    const colors = [
      '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444',
      '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
    ];
    return colors[index % colors.length];
  }

  /**
   * Creates an empty calendar month structure for cases where no notebooks are selected.
   * Provides consistent calendar structure with default values for all summary fields.
   */
  private createEmptyMonth(targetDate: Date): CalendarMonth {
    return {
      year: targetDate.getFullYear(),
      month: targetDate.getMonth(),
      dailyPlans: [],
      monthlySummary: {
        totalSessions: 0,
        totalStudyTime: 0,
        activeNotebooks: [],
        completionRate: 0,
      },
    };
  }
/**
   * Calculates comprehensive monthly summary statistics including total sessions,
   * study time, active notebooks, and completion rates for calendar overview display.
   */
  private calculateMonthlySummary(
    dailyPlans: DailyStudyPlan[], 
    notebooks: NotebookMeta[]
  ): CalendarMonth['monthlySummary'] {
    let totalSessions = 0;
    let totalStudyTime = 0;
    const activeNotebooks = new Set<string>();
    
    dailyPlans.forEach(plan => {
      totalSessions += plan.sessions.length;
      totalStudyTime += plan.totalDuration;
      plan.sessions.forEach(session => {
        activeNotebooks.add(session.notebookMeta.fileId);
      });
    });
    
    return {
      totalSessions,
      totalStudyTime,
      activeNotebooks: Array.from(activeNotebooks),
      completionRate: 0, // Will be calculated based on actual completion data
    };
  }
}