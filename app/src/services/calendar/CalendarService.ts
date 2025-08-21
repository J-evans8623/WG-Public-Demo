/**
 * @file CalendarService.ts
 * @description
 *   Enhanced core service class implementing monthly calendar generation, daily study plan creation,
 *   and multi-subject session scheduling for the BloomMap calendar planner system. This service handles
 *   the complex business logic of transforming atomic lesson units into structured 30/31 day calendar
 *   layouts with balanced subject distribution and optimal time slot allocation. The implementation
 *   manages notebook metadata retrieval, session grouping algorithms, and temporal distribution of
 *   study sessions across user-specified time periods while supporting the new multi-subject daily
 *   planning requirements. The service integrates with existing Firebase storage patterns and provides
 *   methods for generating comprehensive monthly calendars, calculating daily study plans, and managing
 *   the relationship between different study session types across multiple notebooks with enhanced
 *   spaced repetition algorithms that consider subject variety and daily study load balancing.
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

export class CalendarService {

  /**
   * Retrieves lightweight notebook summaries for calendar selection interface.
   * Fetches basic metadata without full lesson unit details to optimize
   * initial loading performance for notebook selection dropdown.
   */
  async getAvailableNotebooks(): Promise<NotebookSummary[]> {
    console.log('[CalendarService.ts][6001] › Fetching available notebooks for calendar selection');
    
    try {
      // Step 1: Fetch user's file list from API
      const response = await fetch('/api/files/list', {
        method: 'GET',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch notebooks: ${response.status}`);
      }
      
      const { ownedFiles } = await response.json();
      console.log('[CalendarService.ts][6002] › Retrieved', ownedFiles.length, 'owned files');
      
      // Step 2: Helper function to calculate total units from either structure
      const calculateTotalUnits = (lessonUnitsMeta: any): number => {
        if (!lessonUnitsMeta) {
          return 0;
        }
        
        // Check if totalUnits is directly available
        if (typeof lessonUnitsMeta.totalUnits === 'number') {
          return lessonUnitsMeta.totalUnits;
        }
        
        // Calculate from unitsByMap structure
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
      
      // Step 3: Filter and transform files with robust unit counting
      const notebooks: NotebookSummary[] = ownedFiles
        .map((file: any) => {
          const totalUnits = calculateTotalUnits(file.lessonUnitsMeta);
          return {
            fileId: file.fileId,
            fileName: file.fileName,
            totalUnits,
            lastUpdated: new Date(file.updatedAt),
            hasLessonMeta: !!file.lessonUnitsMeta, // Debug info
          };
        })
        .filter((notebook: any) => notebook.totalUnits > 0); // Only include notebooks with units
      
      console.log('[CalendarService.ts][6003] › Found', notebooks.length, 'notebooks with lesson units');
      
      return notebooks;
      
    } catch (error) {
      console.error('[CalendarService.ts][6004] › Error fetching available notebooks:', error);
      throw new Error('Failed to load available notebooks');
    }
  }

  /**
   * Loads detailed notebook metadata including full lesson unit arrays for
   * selected notebooks. This method fetches complete metadata required for
   * schedule generation while handling missing or invalid data gracefully.
   */
  async getNotebookDetails(fileIds: string[]): Promise<NotebookMeta[]> {
    console.log('[CalendarService.ts][6005] › Loading detailed metadata for', fileIds.length, 'notebooks');
    
    if (fileIds.length === 0) {
      console.warn('[CalendarService.ts][6006] › No file IDs provided for notebook details');
      return [];
    }
    
    try {
      // Step 1: Request detailed metadata from API
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
      
      // Step 2: Validate and process notebook metadata
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
   * NEW: Generates a complete monthly calendar with daily study plans based on
   * notebook metadata and enhanced configuration. Creates balanced distribution
   * of subjects across days while respecting time slot preferences and session limits.
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
    
    // Step 1: Generate all study sessions for notebooks
    const allSessions = this.generateAllSessions(notebooks, config);
    console.log('[CalendarService.ts][6012] › Generated', allSessions.length, 'total sessions');

    // Step 2: Create daily plans for the entire month
    const dailyPlans = this.distributeSessions(allSessions, config, year, month);
    console.log('[CalendarService.ts][6013] › Created', dailyPlans.length, 'daily plans');

    // Step 3: Calculate monthly summary
    const monthlySummary = this.calculateMonthlySummary(dailyPlans, notebooks);

    const calendarMonth: CalendarMonth = {
      year,
      month,
      dailyPlans,
      monthlySummary,
    };

    console.log('[CalendarService.ts][6014] › Monthly calendar generation completed');
    return calendarMonth;
  }

  /**
   * Generates all study sessions for the provided notebooks according to the
   * spaced repetition algorithm and session type distribution requirements.
   */
  private generateAllSessions(notebooks: NotebookMeta[], config: ScheduleConfig): StudySession[] {
    const sessions: StudySession[] = [];
    let sessionCounter = 0;

    notebooks.forEach((notebook) => {
      console.log('[CalendarService.ts][6015] › Processing notebook:', notebook.fileName, 'with', notebook.lessonUnits.length, 'units');
      
      // Step 1: Group lesson units into session chunks
      const sessionChunks = chunkLessonUnits(notebook.lessonUnits, config.unitsPerBlockSession);
      console.log('[CalendarService.ts][6016] › Created', sessionChunks.length, 'session chunks for', notebook.fileName);
      
      // Step 2: Generate sessions for each chunk
      sessionChunks.forEach((unitChunk, chunkIndex) => {
        // Create block session
        const blockSession = this.createBlockSession(
          notebook,
          unitChunk,
          new Date(), // Date will be assigned during distribution
          sessionCounter++
        );
        sessions.push(blockSession);
        
        // Create revision sessions with spaced intervals
        for (let i = 0; i < config.revisionsPerLesson; i++) {
          const revisionType = i === 0 ? 'revision-block' : 'revision-interleaved';
          const revisionSession = this.createRevisionSession(
            notebook,
            unitChunk,
            new Date(), // Date will be assigned during distribution
            revisionType,
            sessionCounter++
          );
          sessions.push(revisionSession);
        }
      });
    });

    return sessions;
  }

  /**
   * Distributes study sessions across the month with balanced subject allocation
   * and proper time slot management. Ensures each day has the configured number
   * of subjects while respecting daily session limits.
   */
  private distributeSessions(
    sessions: StudySession[], 
    config: ScheduleConfig, 
    year: number, 
    month: number
  ): DailyStudyPlan[] {
    console.log('[CalendarService.ts][6017] › Distributing', sessions.length, 'sessions across month');
    
    const dailyPlans: DailyStudyPlan[] = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Step 1: Create empty daily plans for all days in month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      if (config.daysPerWeek.includes(date.getDay())) {
        dailyPlans.push(this.createEmptyDailyPlan(date));
      }
    }

    // Step 2: Group sessions by notebook for balanced distribution
    const sessionsByNotebook = this.groupSessionsByNotebook(sessions);
    
    // Step 3: Distribute sessions using round-robin subject allocation
    this.allocateSessionsTodays(dailyPlans, sessionsByNotebook, config);

    console.log('[CalendarService.ts][6018] › Session distribution completed');
    return dailyPlans;
  }

  /**
   * Groups study sessions by notebook for balanced daily subject distribution.
   * Maintains separate arrays of sessions for each notebook to enable proper
   * round-robin allocation across study days.
   */
  private groupSessionsByNotebook(sessions: StudySession[]): Record<string, StudySession[]> {
    const grouped: Record<string, StudySession[]> = {};
    
    sessions.forEach(session => {
      const notebookId = session.notebookMeta.fileId;
      if (!grouped[notebookId]) {
        grouped[notebookId] = [];
      }
      grouped[notebookId].push(session);
    });
    
    return grouped;
  }

  /**
   * Allocates sessions to daily plans using balanced subject distribution.
   * Ensures each day has the configured number of different subjects while
   * respecting session limits and time slot preferences.
   */
  private allocateSessionsTodays(
    dailyPlans: DailyStudyPlan[], 
    sessionsByNotebook: Record<string, StudySession[]>, 
    config: ScheduleConfig
  ): void {
    const notebookIds = Object.keys(sessionsByNotebook);
    const sessionQueues = { ...sessionsByNotebook }; // Copy for mutation
    
    let currentDayIndex = 0;
    let currentNotebookIndex = 0;
    
    // Continue until all sessions are allocated
    while (Object.values(sessionQueues).some(queue => queue.length > 0)) {
      if (currentDayIndex >= dailyPlans.length) {
        currentDayIndex = 0; // Wrap around to start of month
      }
      
      const currentDay = dailyPlans[currentDayIndex];
      
      // Check if day can accept more sessions
      if (currentDay.sessions.length >= config.maxSessionsPerDay) {
        currentDayIndex++;
        continue;
      }
      
      // Check if day needs more subjects
      const currentSubjects = new Set(currentDay.sessions.map(s => s.notebookMeta.fileId));
      if (currentSubjects.size >= config.subjectsPerDay && 
          currentDay.sessions.length >= config.subjectsPerDay) {
        currentDayIndex++;
        continue;
      }
      
      // Find next notebook with available sessions
      let attempts = 0;
      while (attempts < notebookIds.length) {
        const notebookId = notebookIds[currentNotebookIndex % notebookIds.length];
        
        if (sessionQueues[notebookId] && sessionQueues[notebookId].length > 0) {
          // Check if this subject is already scheduled for today (if we want variety)
          if (!currentSubjects.has(notebookId) || currentSubjects.size < config.subjectsPerDay) {
            const session = sessionQueues[notebookId].shift()!;
            
            // Assign date and time slot
            session.date = new Date(currentDay.date);
            session.timeSlot = this.assignTimeSlot(currentDay.sessions.length, config);
            
            currentDay.sessions.push(session);
            this.updateDailyPlanMetadata(currentDay);
            
            break;
          }
        }
        
        currentNotebookIndex++;
        attempts++;
      }
      
      currentNotebookIndex++;
      
      // Move to next day if current day is full or we couldn't find a suitable session
      if (currentDay.sessions.length >= config.maxSessionsPerDay || attempts >= notebookIds.length) {
        currentDayIndex++;
      }
    }
  }

  /**
   * Assigns appropriate time slot based on session position and user preferences.
   * Distributes sessions across available time slots to provide daily variety.
   */
  private assignTimeSlot(
    sessionIndex: number, 
    config: ScheduleConfig
  ): 'morning' | 'afternoon' | 'evening' {
    const timeSlots = config.preferredTimeSlots;
    return timeSlots[sessionIndex % timeSlots.length];
  }

  /**
   * Creates an empty daily study plan for the specified date with
   * default metadata and empty session arrays for population.
   */
  private createEmptyDailyPlan(date: Date): DailyStudyPlan {
    return {
      date: new Date(date),
      sessions: [],
      subjectSummary: {},
      totalDuration: 0,
      completedSessions: [],
    };
  }

  /**
   * Updates daily plan metadata after adding sessions including subject
   * summary, total duration calculation, and other derived information.
   */
  private updateDailyPlanMetadata(dailyPlan: DailyStudyPlan): void {
    const subjectSummary: any = {};
    let totalDuration = 0;
    
    dailyPlan.sessions.forEach(session => {
      const notebookId = session.notebookMeta.fileId;
      
      if (!subjectSummary[notebookId]) {
        subjectSummary[notebookId] = {
          notebookName: session.notebookMeta.fileName,
          sessionCount: 0,
          totalUnits: 0,
          color: session.notebookMeta.color || '#6B7280',
        };
      }
      
      subjectSummary[notebookId].sessionCount++;
      subjectSummary[notebookId].totalUnits += session.sessionConfig.unitCount;
      totalDuration += session.metadata.estimatedDuration;
    });
    
    dailyPlan.subjectSummary = subjectSummary;
    dailyPlan.totalDuration = totalDuration;
  }

  /**
   * Creates an empty calendar month structure for cases where no
   * notebooks are selected or schedule generation fails.
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
   * Calculates comprehensive monthly summary statistics including
   * total sessions, study time, active notebooks, and completion rates.
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

  /**
   * Creates a block-style study session for initial learning of new content.
   * Block sessions focus on comprehensive coverage of lesson units with full
   * concept map traversal including all nested resources and materials.
   */
  private createBlockSession(
    notebook: NotebookMeta,
    unitChunk: LessonUnit[],
    date: Date,
    sessionId: number
  ): StudySession {
    console.log('[CalendarService.ts][6019] › Creating block session for', unitChunk.length, 'units');
    
    // Step 1: Generate unique session ID
    const sessionIdString = `block-${notebook.fileId}-${sessionId}-${Date.now()}`;
    
    // Step 2: Calculate session metadata
    const topicTitles = unitChunk.map(unit => unit.conceptNodeTitle);
    const sessionTitle = `${notebook.fileName}: ${topicTitles.join(', ')}`;
    const estimatedDuration = unitChunk.length * 15; // 15 minutes per unit
    
    console.log('[CalendarService.ts][6020] › Block session created:', sessionTitle);
    
    return {
      id: sessionIdString,
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
   * Creates a revision-style study session for reinforcing previously learned
   * content. Revision sessions use flashcards and quizzes from the existing
   * user data system to implement spaced repetition learning.
   */
  private createRevisionSession(
    notebook: NotebookMeta,
    unitChunk: LessonUnit[],
    date: Date,
    type: 'revision-block' | 'revision-interleaved',
    sessionId: number
  ): StudySession {
    console.log('[CalendarService.ts][6021] › Creating', type, 'revision session for', unitChunk.length, 'units');
    
    // Step 1: Generate unique session ID
    const sessionIdString = `revision-${notebook.fileId}-${sessionId}-${Date.now()}`;
    
    // Step 2: Calculate session metadata
    const topicTitles = unitChunk.map(unit => unit.conceptNodeTitle);
    const sessionTitle = `Review: ${topicTitles.join(', ')}`;
    const estimatedDuration = unitChunk.length * 10; // Shorter for revision
    
    console.log('[CalendarService.ts][6022] › Revision session created:', sessionTitle);
    
    return {
      id: sessionIdString,
      date: new Date(date),
      notebookMeta: notebook,
      targetLessonUnits: unitChunk,
      type,
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
}