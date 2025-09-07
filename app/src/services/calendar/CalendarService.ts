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
   * Generates a complete monthly calendar with daily study plans based on notebook metadata 
   * and enhanced configuration using learning sets, cyclical distribution, and staggered session scheduling.
   */
  async generateMonthlyCalendar(
    notebooks: NotebookMeta[], 
    config: ScheduleConfig, 
    targetDate: Date
  ): Promise<CalendarMonth> {
    console.log('[CalendarService.ts][6010] › Generating monthly calendar for', notebooks.length, 'notebooks');
    
    if (notebooks.length === 0) {
      console.warn('[CalendarService.ts][6011] › No notebooks provided for calendar generation');
      return this.createEmptyMonth(targetDate);
    }

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    
    // Step 1: Phase 1 - Create learning sets using ceiling division
    const learningSets = this.createLearningSets(notebooks, config);
    console.log('[CalendarService.ts][6012] › Created', learningSets.length, 'learning sets');

    // Step 2: Phase 2 & 3 - Generate cyclical schedule with staggered session scheduling
    const dailyPlans = this.generateStaggeredSchedule(learningSets, config, year, month);
    console.log('[CalendarService.ts][6013] › Generated', dailyPlans.length, 'daily plans with staggered scheduling');

    // Step 3: Calculate monthly summary
    const monthlySummary = this.calculateMonthlySummary(dailyPlans, notebooks);

    const calendarMonth: CalendarMonth = {
      year,
      month,
      dailyPlans,
      monthlySummary,
    };

    console.log('[CalendarService.ts][6014] › Monthly calendar generation completed with staggered session scheduling');
    return calendarMonth;
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
    month: number
  ): DailyStudyPlan[] {
    console.log('[CalendarService.ts][6019] › Phase 2&3: Generating staggered schedule with', learningSets.length, 'learning sets');
    
    const dailyPlans: DailyStudyPlan[] = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Step 1: Initialize comprehensive scheduling context for staggered session management
    const schedulingContext: SessionSchedulingContext = {
      completedLessons: new Map(),
      lastRevisionDay: new Map(),
      interleaveStartDay: new Map(),
      lessonChunkSchedule: new Map(),
      pendingRevisions: new Map(),
      interleaveSchedule: new Map(),
    };

    // Step 2: Pre-populate scheduling context with notebook structures
    learningSets.forEach(learningSet => {
      learningSet.notebooks.forEach(notebook => {
        schedulingContext.completedLessons.set(notebook.fileId, new Set());
        schedulingContext.lastRevisionDay.set(notebook.fileId, new Map());
        schedulingContext.lessonChunkSchedule.set(notebook.fileId, new Map());
        schedulingContext.interleaveSchedule.set(notebook.fileId, []);
      });
    });

    let studyDayCounter = 0;
    
    // Step 3: First pass - Schedule all block learning sessions and plan revision sequences
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const dayOfWeek = currentDate.getDay();
      
      if (config.daysPerWeek.includes(dayOfWeek)) {
        const learningSetIndex = studyDayCounter % learningSets.length;
        const assignedLearningSet = learningSets[learningSetIndex];
        
        console.log('[CalendarService.ts][6020] › Day', day, 'processing learning set', assignedLearningSet.id);
        
        // Step 4: Schedule block learning sessions and plan staggered revisions
        this.scheduleBlockLearningWithRevisions(
          assignedLearningSet,
          studyDayCounter,
          day,
          config,
          schedulingContext
        );
        
        studyDayCounter++;
      }
    }

    console.log('[CalendarService.ts][6021] › Completed block learning scheduling, processing', schedulingContext.pendingRevisions.size, 'revision days');

    studyDayCounter = 0;

    // Step 5: Second pass - Create daily plans with all session types
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const dayOfWeek = currentDate.getDay();
      
      if (config.daysPerWeek.includes(dayOfWeek)) {
        const learningSetIndex = studyDayCounter % learningSets.length;
        const assignedLearningSet = learningSets[learningSetIndex];
        
        // Step 6: Create comprehensive daily plan with all session types
        const dailyPlan = this.createStaggeredDailyPlan(
          currentDate,
          assignedLearningSet,
          config,
          studyDayCounter,
          day,
          schedulingContext
        );
        
        dailyPlans.push(dailyPlan);
        studyDayCounter++;
      }
    }
    
    console.log('[CalendarService.ts][6022] › Phase 2&3 complete: Generated', dailyPlans.length, 'daily plans with staggered scheduling');
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

  learningSet.notebooks.forEach(notebook => {
    const sessionChunks = chunkLessonUnits(notebook.lessonUnits, config.unitsPerBlockSession);
    const notebookSchedule = context.lessonChunkSchedule.get(notebook.fileId)!;
    const revisionSchedule = context.lastRevisionDay.get(notebook.fileId)!;
    
    // Step 1: Determine which chunk should be scheduled for this study day
    // Fixed: Remove undefined variable reference
    const notebookLearningDayIndex = Math.floor(studyDayIndex / learningSet.notebooks.length);
    
    if (notebookLearningDayIndex < sessionChunks.length) {
      const chunkIndex = notebookLearningDayIndex;
      const targetChunk = sessionChunks[chunkIndex];
      
      console.log('[CalendarService.ts][6024] › Scheduling chunk', chunkIndex, 'for notebook', notebook.fileName, 'on day', currentDay);
      
      // Step 2: Record block learning session scheduling
      notebookSchedule.set(chunkIndex, currentDay);
      
      // Step 3: Schedule revision blocks with +1 day offsets
      for (let revisionIndex = 0; revisionIndex < config.revisionsPerLesson; revisionIndex++) {
        const revisionDay = currentDay + 1 + revisionIndex;
        
        // Step 4: Create pending revision entry
        if (!context.pendingRevisions.has(revisionDay)) {
          context.pendingRevisions.set(revisionDay, []);
        }
        
        context.pendingRevisions.get(revisionDay)!.push({
          notebookId: notebook.fileId,
          chunkIndex,
          revisionIndex,
          sessionType: 'revision-block',
          targetDay: revisionDay,
          lessonUnits: targetChunk,
        });
        
        // Step 5: Track last revision day for interleaved scheduling
        revisionSchedule.set(chunkIndex, revisionDay);
        
        console.log('[CalendarService.ts][6025] › Scheduled revision', revisionIndex, 'for chunk', chunkIndex, 'on day', revisionDay);
      }
      
      // Step 6: Check for lesson completion and schedule interleaved sessions
      if (chunkIndex === sessionChunks.length - 1) {
        const lastRevisionDay = Math.max(...Array.from(revisionSchedule.values()));
        const interleaveStartDay = lastRevisionDay + 3;
        
        context.interleaveStartDay.set(notebook.fileId, interleaveStartDay);
        
        // Step 7: Schedule interleaved sessions (3 * number of lessons in notebook)
        const interleaveCount = sessionChunks.length * 3;
        const interleaveSchedule = context.interleaveSchedule.get(notebook.fileId)!;
        
        for (let i = 0; i < interleaveCount; i++) {
          const interleaveDay = interleaveStartDay + (i * 3);
          interleaveSchedule.push(interleaveDay);
          
          // Step 8: Schedule interleaved revision sessions
          if (!context.pendingRevisions.has(interleaveDay)) {
            context.pendingRevisions.set(interleaveDay, []);
          }
          
          context.pendingRevisions.get(interleaveDay)!.push({
            notebookId: notebook.fileId,
            chunkIndex: -1, // Special marker for interleaved sessions
            revisionIndex: i,
            sessionType: 'revision-interleaved',
            targetDay: interleaveDay,
            lessonUnits: [], // Will use all notebook lessons
          });
          
          console.log('[CalendarService.ts][6026] › Scheduled interleaved session', i, 'for notebook', notebook.fileName, 'on day', interleaveDay);
        }
      }
    }
  });
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
  
  // Step 1: Add block learning sessions for current learning set
  learningSet.notebooks.forEach((notebook, notebookIndex) => {
    const sessionChunks = chunkLessonUnits(notebook.lessonUnits, config.unitsPerBlockSession);
    const notebookSchedule = context.lessonChunkSchedule.get(notebook.fileId)!;
    
    // Step 2: Check if this notebook has a block learning session scheduled for today
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
  
  // Step 3: Add pending revision sessions for current day
  const pendingRevisions = context.pendingRevisions.get(currentDay) || [];
  let revisionSessionCount = 0;
  
  pendingRevisions.forEach(revision => {
    // Fixed: Correct notebook lookup logic
    const notebook = this.findNotebookInLearningSet(learningSet, revision.notebookId);
    
    if (notebook) {
      let session: StudySession;
      
      if (revision.sessionType === 'revision-interleaved') {
        // Step 4: Create interleaved revision session using all notebook lessons
        session = this.createInterleavedRevisionSession(
          notebook,
          date,
          `interleaved-${revision.notebookId}-${revision.revisionIndex}-${currentDay}`
        );
      } else {
        // Step 5: Create block revision session for specific lesson chunk
        session = this.createRevisionBlockSession(
          notebook,
          revision.lessonUnits,
          date,
          `revision-${revision.notebookId}-${revision.chunkIndex}-${revision.revisionIndex}-${currentDay}`
        );
      }
      
      // Step 6: Assign time slot offset for revision sessions
      const baseTimeSlotIndex = sessions.length % config.preferredTimeSlots.length;
      session.timeSlot = config.preferredTimeSlots[baseTimeSlotIndex];
      
      sessions.push(session);
      totalDuration += session.metadata.estimatedDuration;
      
      this.updateSubjectSummary(subjectSummary, notebook, 1, revision.lessonUnits.length, revisionSessionCount);
      revisionSessionCount++;
      
      console.log('[CalendarService.ts][6029] › Added', revision.sessionType, 'session for', notebook.fileName);
    }
  });
  
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