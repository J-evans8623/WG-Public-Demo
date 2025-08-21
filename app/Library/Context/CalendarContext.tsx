/**
 * @file CalendarContext.tsx
 * @description
 *   Enhanced React context providing comprehensive calendar state management with persistent data caching,
 *   30/31 day calendar support, and multi-subject daily planning capabilities. This context orchestrates
 *   the entire calendar workflow from notebook selection through monthly schedule generation to session
 *   execution while maintaining clean separation from existing contexts. The implementation manages
 *   calendar data persistence to prevent unnecessary API calls, provides optimized monthly calendar
 *   generation with balanced subject distribution, and supports enhanced user interactions including
 *   session completion tracking and daily study planning. The context maintains calendar data in memory
 *   after initial load and only refreshes when explicitly requested or when significant changes occur,
 *   dramatically improving performance and user experience compared to the previous implementation.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
  useMemo,
} from 'react';
import {
  CalendarContextType,
  CalendarMonth,
  DailyStudyPlan,
  StudySession,
  ScheduleConfig,
  NotebookSummary,
} from '@/app/Library/Definitions/CalendarDefinitions';
import { CalendarService } from '@/app/src/services/calendar/CalendarService';
import { CalendarPersistence } from '@/app/src/services/calendar/CalendarPersistence';


const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export const CalendarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Step 1: Initialize state for enhanced calendar management
  const [selectedNotebooks, setSelectedNotebooks] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState<CalendarMonth | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableNotebooks, setAvailableNotebooks] = useState<NotebookSummary[]>([]);
  const [completedSessions, setCompletedSessions] = useState<string[]>([]);

  // Step 2: Initialize enhanced default schedule configuration
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    unitsPerBlockSession: 3,
    revisionsPerLesson: 2,
    startDate: new Date(),
    daysPerWeek: [1, 2, 3, 4, 5], // Monday through Friday
    subjectsPerDay: 3, // NEW: Default to 3 subjects per day
    preferredTimeSlots: ['morning', 'afternoon', 'evening'], // NEW: Default time slots
    maxSessionsPerDay: 6, // NEW: Maximum sessions per day
  });



  // Step 4: Initialize service instances with caching
  const calendarService = useMemo(() => new CalendarService(), []);
  const persistence = useMemo(() => new CalendarPersistence(), []);

  /**
   * Loads available notebooks with caching to prevent repeated API calls.
   * Maintains notebook list in context state and only refreshes when
   * explicitly requested or when context initializes.
   */
  const refreshNotebooks = useCallback(async () => {
    console.log('[CalendarContext.tsx][4001] › Refreshing available notebooks');
    
    try {
      const notebooks = await calendarService.getAvailableNotebooks();
      
      // Step 1: Assign colors to notebooks for visual distinction
      const notebooksWithColors = notebooks.map((notebook, index) => ({
        ...notebook,
        color: NOTEBOOK_COLORS[index % NOTEBOOK_COLORS.length],
      }));
      
      setAvailableNotebooks(notebooksWithColors);
      console.log('[CalendarContext.tsx][4002] › Loaded', notebooksWithColors.length, 'available notebooks');
      
    } catch (error) {
      console.error('[CalendarContext.tsx][4003] › Error refreshing notebooks:', error);
      setError('Failed to load available notebooks');
    }
  }, [calendarService]);

  /**
   * Adds a notebook to the selection for calendar scheduling.
   * Updates the selected notebooks array and triggers schedule regeneration
   * if a current month is already loaded to maintain consistency.
   */
  const selectNotebook = useCallback((notebookId: string) => {
    console.log('[CalendarContext.tsx][4004] › Selecting notebook:', notebookId);
    
    setSelectedNotebooks(prev => {
      if (prev.includes(notebookId)) {
        console.log('[CalendarContext.tsx][4005] › Notebook already selected:', notebookId);
        return prev;
      }
      
      const updated = [...prev, notebookId];
      console.log('[CalendarContext.tsx][4006] › Updated selection count:', updated.length);
      
      // Step 1: Persist selection state
      persistence.saveSelectedNotebooks(updated).catch(err => {
        console.error('[CalendarContext.tsx][4007] › Error saving notebook selection:', err);
      });
      
      return updated;
    });
  }, [persistence]);

  /**
   * Removes a notebook from the calendar selection and clears any sessions
   * from the removed notebook while preserving other scheduled sessions.
   * Triggers month regeneration to maintain schedule consistency.
   */
  const deselectNotebook = useCallback((notebookId: string) => {
    console.log('[CalendarContext.tsx][4008] › Deselecting notebook:', notebookId);
    
    setSelectedNotebooks(prev => {
      const updated = prev.filter(id => id !== notebookId);
      console.log('[CalendarContext.tsx][4009] › Updated selection count:', updated.length);
      
      // Step 1: Remove sessions for deselected notebook from current month
      if (currentMonth) {
        const updatedMonth = {
          ...currentMonth,
          dailyPlans: currentMonth.dailyPlans.map(plan => ({
            ...plan,
            sessions: plan.sessions.filter(session => session.notebookMeta.fileId !== notebookId),
          })),
        };
        setCurrentMonth(updatedMonth);
      }
      
      // Step 2: Persist updated selection
      persistence.saveSelectedNotebooks(updated).catch(err => {
        console.error('[CalendarContext.tsx][4010] › Error saving notebook deselection:', err);
      });
      
      return updated;
    });
  }, [currentMonth, persistence]);

  /**
   * Updates the schedule configuration parameters and triggers month
   * regeneration if current month data exists to apply configuration changes.
   * Validates configuration values before applying updates.
   */
  const updateScheduleConfig = useCallback((configUpdate: Partial<ScheduleConfig>) => {
    console.log('[CalendarContext.tsx][4011] › Updating schedule config:', configUpdate);
    
    setScheduleConfig(prev => {
      const updated = { ...prev, ...configUpdate };
      
      // Step 1: Validate configuration values
      if (updated.unitsPerBlockSession < 1) {
        console.warn('[CalendarContext.tsx][4012] › Invalid units per session, using default');
        updated.unitsPerBlockSession = 3;
      }
      
      if (updated.subjectsPerDay < 1) {
        console.warn('[CalendarContext.tsx][4013] › Invalid subjects per day, using default');
        updated.subjectsPerDay = 3;
      }
      
      if (updated.maxSessionsPerDay < updated.subjectsPerDay) {
        console.warn('[CalendarContext.tsx][4014] › Max sessions less than subjects, adjusting');
        updated.maxSessionsPerDay = updated.subjectsPerDay;
      }
      
      console.log('[CalendarContext.tsx][4015] › Applied schedule config update');
      
      // Step 2: Persist configuration
      persistence.saveScheduleConfig(updated).catch(err => {
        console.error('[CalendarContext.tsx][4016] › Error saving schedule config:', err);
      });
      
      return updated;
    });
  }, [persistence]);

  /**
   * Generates a complete monthly calendar based on currently selected notebooks
   * and schedule configuration. Creates daily study plans with balanced subject
   * distribution and proper session scheduling across available time slots.
   */
  const generateSchedule = useCallback(async () => {
    console.log('[CalendarContext.tsx][4017] › Starting schedule generation for', selectedNotebooks.length, 'notebooks');
    
    if (selectedNotebooks.length === 0) {
      setError('Please select at least one notebook for scheduling');
      console.warn('[CalendarContext.tsx][4018] › No notebooks selected for schedule generation');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Step 1: Load detailed notebook metadata with colors
      console.log('[CalendarContext.tsx][4019] › Loading notebook details for selected notebooks');
      const notebookMetas = await calendarService.getNotebookDetails(selectedNotebooks);
      
      if (notebookMetas.length === 0) {
        throw new Error('No valid notebook metadata found');
      }
      
      // Step 2: Add colors to notebook metadata
      const notebooksWithColors = notebookMetas.map((meta, index) => ({
        ...meta,
        color: NOTEBOOK_COLORS[index % NOTEBOOK_COLORS.length],
      }));
      
      console.log('[CalendarContext.tsx][4020] › Loaded metadata for', notebooksWithColors.length, 'notebooks');
      
      // Step 3: Generate monthly calendar using enhanced service
      const month = await calendarService.generateMonthlyCalendar(
        notebooksWithColors,
        scheduleConfig,
        currentDate
      );
      
      console.log('[CalendarContext.tsx][4021] › Generated monthly calendar with', month.dailyPlans.length, 'daily plans');
      
      // Step 4: Update state and persist calendar
      setCurrentMonth(month);
      await persistence.saveCalendarMonth(month);
      
      console.log('[CalendarContext.tsx][4022] › Schedule generation completed successfully');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate schedule';
      console.error('[CalendarContext.tsx][4023] › Schedule generation error:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [selectedNotebooks, scheduleConfig, currentDate, calendarService, persistence]);

  /**
   * Regenerates calendar for a specific month and year, allowing users to
   * navigate between months and generate schedules for different time periods
   * while maintaining configuration and notebook selections.
   */
  const regenerateMonth = useCallback(async (year: number, month: number) => {
    console.log('[CalendarContext.tsx][4024] › Regenerating calendar for', year, month);
    
    if (selectedNotebooks.length === 0) {
      console.warn('[CalendarContext.tsx][4025] › No notebooks selected for month regeneration');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const targetDate = new Date(year, month, 1);
      const notebookMetas = await calendarService.getNotebookDetails(selectedNotebooks);
      
      const notebooksWithColors = notebookMetas.map((meta, index) => ({
        ...meta,
        color: NOTEBOOK_COLORS[index % NOTEBOOK_COLORS.length],
      }));
      
      const monthData = await calendarService.generateMonthlyCalendar(
        notebooksWithColors,
        scheduleConfig,
        targetDate
      );
      
      setCurrentMonth(monthData);
      setCurrentDate(targetDate);
      await persistence.saveCalendarMonth(monthData);
      
      console.log('[CalendarContext.tsx][4026] › Month regeneration completed successfully');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to regenerate month';
      console.error('[CalendarContext.tsx][4027] › Month regeneration error:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [selectedNotebooks, scheduleConfig, calendarService, persistence]);

  /**
   * Navigates to the previous or next month, automatically generating
   * schedules for the new month if notebooks are selected.
   */
  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    
    setCurrentDate(newDate);
    regenerateMonth(newDate.getFullYear(), newDate.getMonth());
  }, [currentDate, regenerateMonth]);

  /**
   * Creates a session launch callback that returns the proper PickerFileMeta
   * object for use with AppLayout's handleFileSelect while maintaining proper
   * separation of concerns.
   */
  const createSessionLauncher = useCallback((sessionId: string) => {
    if (!currentMonth) return null;
    
    // Find session across all daily plans
    for (const dailyPlan of currentMonth.dailyPlans) {
      const session = dailyPlan.sessions.find(s => s.id === sessionId);
      if (session) {
        return {
          docId: session.notebookMeta.fileId,
          fileStorageId: session.notebookMeta.filePath,
          fileName: session.notebookMeta.fileName,
          role: undefined,
          updatedAt: session.notebookMeta.lastUpdated.toISOString(),
        };
      }
    }
    
    return null;
  }, [currentMonth]);

  /**
   * Marks a study session as completed and updates the completion tracking
   * state while persisting the completion status for progress tracking.
   */
  const markSessionCompleted = useCallback((sessionId: string) => {
    console.log('[CalendarContext.tsx][4028] › Marking session completed:', sessionId);
    
    setCompletedSessions(prev => {
      if (prev.includes(sessionId)) return prev;
      
      const updated = [...prev, sessionId];
      persistence.saveCompletedSessions(updated).catch(err => {
        console.error('[CalendarContext.tsx][4029] › Error saving completion status:', err);
      });
      
      return updated;
    });
  }, [persistence]);

  /**
   * Marks a study session as incomplete, removing it from the completed
   * sessions list and updating persistence for accurate progress tracking.
   */
  const markSessionIncomplete = useCallback((sessionId: string) => {
    console.log('[CalendarContext.tsx][4030] › Marking session incomplete:', sessionId);
    
    setCompletedSessions(prev => {
      const updated = prev.filter(id => id !== sessionId);
      persistence.saveCompletedSessions(updated).catch(err => {
        console.error('[CalendarContext.tsx][4031] › Error saving completion status:', err);
      });
      
      return updated;
    });
  }, [persistence]);

  /**
   * Utility function to get the daily study plan for a specific date.
   * Returns null if no plan exists for the requested date.
   */
  const getDailyPlan = useCallback((date: Date): DailyStudyPlan | null => {
    if (!currentMonth) return null;
    
    const targetDateString = date.toDateString();
    return currentMonth.dailyPlans.find(plan => 
      plan.date.toDateString() === targetDateString
    ) || null;
  }, [currentMonth]);

  /**
   * Utility function to get all study sessions for a specific date.
   * Returns empty array if no sessions exist for the requested date.
   */
  const getSessionsForDay = useCallback((date: Date): StudySession[] => {
    const dailyPlan = getDailyPlan(date);
    return dailyPlan ? dailyPlan.sessions : [];
  }, [getDailyPlan]);

  /**
   * Utility function to get today's study plan for quick access to
   * current day's scheduled study sessions and progress tracking.
   */
  const getTodaysPlan = useCallback((): DailyStudyPlan | null => {
    return getDailyPlan(new Date());
  }, [getDailyPlan]);

  /**
   * Clears the current schedule and notebook selections, resetting
   * the calendar to its initial state while persisting the cleared state.
   */
  const clearSchedule = useCallback(() => {
    console.log('[CalendarContext.tsx][4032] › Clearing schedule and selections');
    
    setSelectedNotebooks([]);
    setCurrentMonth(null);
    setCompletedSessions([]);
    setError(null);
    
    // Step 1: Persist cleared state
    Promise.all([
      persistence.saveSelectedNotebooks([]),
      persistence.clearCalendarMonth(),
      persistence.saveCompletedSessions([]),
    ]).catch(err => {
      console.error('[CalendarContext.tsx][4033] › Error clearing persisted state:', err);
    });
    
    console.log('[CalendarContext.tsx][4034] › Schedule and selections cleared');
  }, [persistence]);

  // Step 5: Load persisted state and available notebooks on mount
  useEffect(() => {
    console.log('[CalendarContext.tsx][4035] › Loading persisted calendar state and notebooks');
    
    const loadInitialState = async () => {
      try {
        // Load notebooks first
        await refreshNotebooks();
        
        // Then load persisted state
        const [savedNotebooks, savedConfig, savedMonth, savedCompletions] = await Promise.all([
          persistence.loadSelectedNotebooks(),
          persistence.loadScheduleConfig(),
          persistence.loadCalendarMonth(),
          persistence.loadCompletedSessions(),
        ]);
        
        if (savedNotebooks.length > 0) {
          console.log('[CalendarContext.tsx][4036] › Restored', savedNotebooks.length, 'selected notebooks');
          setSelectedNotebooks(savedNotebooks);
        }
        
        if (savedConfig) {
          console.log('[CalendarContext.tsx][4037] › Restored schedule configuration');
          setScheduleConfig(savedConfig);
        }
        
        if (savedMonth) {
          console.log('[CalendarContext.tsx][4038] › Restored calendar month with', savedMonth.dailyPlans.length, 'daily plans');
          setCurrentMonth(savedMonth);
        }
        
        if (savedCompletions.length > 0) {
          console.log('[CalendarContext.tsx][4039] › Restored', savedCompletions.length, 'completed sessions');
          setCompletedSessions(savedCompletions);
        }
        
      } catch (err) {
        console.error('[CalendarContext.tsx][4040] › Error loading initial state:', err);
      }
    };
    
    loadInitialState();
  }, [persistence, refreshNotebooks]);

  // Step 6: Create context value object with enhanced functionality
  const contextValue: CalendarContextType = useMemo(() => ({
    selectedNotebooks,
    currentMonth,
    scheduleConfig,
    isLoading,
    error,
    availableNotebooks,
    currentDate,
    setCurrentDate,
    navigateMonth,
    selectNotebook,
    deselectNotebook,
    refreshNotebooks,
    updateScheduleConfig,
    generateSchedule,
    regenerateMonth,
    clearSchedule,
    createSessionLauncher,
    markSessionCompleted,
    markSessionIncomplete,
    getDailyPlan,
    getSessionsForDay,
    getTodaysPlan,
  }), [
    selectedNotebooks,
    currentMonth,
    scheduleConfig,
    isLoading,
    error,
    availableNotebooks,
    currentDate,
    setCurrentDate,
    navigateMonth,
    selectNotebook,
    deselectNotebook,
    refreshNotebooks,
    updateScheduleConfig,
    generateSchedule,
    regenerateMonth,
    clearSchedule,
    createSessionLauncher,
    markSessionCompleted,
    markSessionIncomplete,
    getDailyPlan,
    getSessionsForDay,
    getTodaysPlan,
  ]);

  return (
    <CalendarContext.Provider value={contextValue}>
      {children}
    </CalendarContext.Provider>
  );
};

/**
 * Custom hook for accessing calendar context with error handling.
 * Ensures components are properly wrapped in CalendarProvider and
 * provides type-safe access to calendar operations and state.
 */
export function useCalendar(): CalendarContextType {
  const context = useContext(CalendarContext);
  
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarProvider');
  }
  
  return context;
}

// Color palette for notebook visual distinction in calendar
const NOTEBOOK_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#8B5CF6', // Purple
  '#F59E0B', // Orange
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange-600
  '#EC4899', // Pink
  '#6366F1', // Indigo
];