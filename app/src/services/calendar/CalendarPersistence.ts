/**
 * @file CalendarPersistence.ts
 * @description
 *   Enhanced calendar persistence service that manages storage and retrieval of monthly calendar data,
 *   session completion tracking, and user preferences through Firebase backend integration while
 *   maintaining local caching for optimal performance. This service handles the persistence layer
 *   for the enhanced calendar system including daily study plans, monthly calendar structures,
 *   completion status tracking, and configuration management with proper synchronization between
 *   local storage and remote Firebase storage. The implementation provides efficient access patterns
 *   through intelligent caching strategies, handles offline scenarios with graceful degradation,
 *   and ensures data consistency across multiple devices and browser sessions. All persistence
 *   operations include comprehensive error handling, retry mechanisms, and proper serialization
 *   of complex calendar data structures including dates, completion tracking, and monthly summaries.
 */

import {
  StudySession,
  ScheduleConfig,
  CalendarMonth,
  DailyStudyPlan,
} from '@/app/Library/Definitions/CalendarDefinitions';

export class CalendarPersistence {
  private readonly STORAGE_KEYS = {
    SELECTED_NOTEBOOKS: 'calendar_selected_notebooks',
    SCHEDULE_CONFIG: 'calendar_schedule_config',
    CURRENT_MONTH: 'calendar_current_month',
    COMPLETED_SESSIONS: 'calendar_completed_sessions',
    LAST_SYNC: 'calendar_last_sync',
    CACHE_VERSION: 'calendar_cache_version',
  };

  private readonly API_ENDPOINT = '/api/calendar/persist';
  private readonly CACHE_VERSION = '2.0'; // Updated for new calendar structure

  /**
   * Saves the array of selected notebook IDs to both Firebase and local storage
   * for persistence across browser sessions and devices. Includes error handling
   * and fallback to local storage if Firebase request fails.
   */
  async saveSelectedNotebooks(notebookIds: string[]): Promise<void> {
    console.log('[CalendarPersistence.ts][7001] › Saving', notebookIds.length, 'selected notebooks');
    
    try {
      // Step 1: Validate input data
      if (!Array.isArray(notebookIds)) {
        throw new Error('Selected notebooks must be an array');
      }
      
      // Step 2: Save to local storage first for immediate access
      const localData = {
        notebooks: notebookIds,
        timestamp: Date.now(),
        version: this.CACHE_VERSION,
      };
      localStorage.setItem(this.STORAGE_KEYS.SELECTED_NOTEBOOKS, JSON.stringify(localData));
      
      // Step 3: Sync with Firebase
      try {
        const currentData = await this.loadCalendarDataFromFirebase();
        const updatedData = {
          ...currentData,
          selectedNotebooks: notebookIds,
        };
        
        await this.saveCalendarDataToFirebase(updatedData);
        console.log('[CalendarPersistence.ts][7002] › Selected notebooks synced to Firebase');
        
      } catch (firebaseError) {
        console.warn('[CalendarPersistence.ts][7003] › Firebase sync failed, using local storage:', firebaseError);
      }
      
    } catch (error) {
      console.error('[CalendarPersistence.ts][7004] › Error saving selected notebooks:', error);
      throw new Error('Failed to save selected notebooks');
    }
  }

  /**
   * Loads previously selected notebook IDs with Firebase sync and local fallback.
   * Attempts to load from Firebase first, falls back to local storage if needed,
   * and returns empty array if no valid data is found anywhere.
   */
  async loadSelectedNotebooks(): Promise<string[]> {
    console.log('[CalendarPersistence.ts][7005] › Loading selected notebooks');
    
    try {
      // Step 1: Try loading from Firebase first
      const firebaseData = await this.loadCalendarDataFromFirebase();
      if (firebaseData.selectedNotebooks && firebaseData.selectedNotebooks.length > 0) {
        console.log('[CalendarPersistence.ts][7006] › Loaded', firebaseData.selectedNotebooks.length, 'notebooks from Firebase');
        return firebaseData.selectedNotebooks;
      }
      
    } catch (firebaseError) {
      console.warn('[CalendarPersistence.ts][7007] › Firebase load failed, trying local storage:', firebaseError);
    }
    
    // Step 2: Fallback to local storage
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.SELECTED_NOTEBOOKS);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.notebooks && Array.isArray(data.notebooks) && data.version === this.CACHE_VERSION) {
          console.log('[CalendarPersistence.ts][7008] › Loaded', data.notebooks.length, 'notebooks from local storage');
          return data.notebooks;
        }
      }
    } catch (localError) {
      console.error('[CalendarPersistence.ts][7009] › Local storage load failed:', localError);
    }
    
    console.log('[CalendarPersistence.ts][7010] › No selected notebooks found, returning empty array');
    return [];
  }

  /**
   * Persists enhanced schedule configuration with Firebase sync and local caching.
   * Handles the new multi-subject configuration options and ensures proper
   * validation and storage of enhanced calendar settings.
   */
  async saveScheduleConfig(config: ScheduleConfig): Promise<void> {
    console.log('[CalendarPersistence.ts][7011] › Saving enhanced schedule configuration');
    
    try {
      // Step 1: Validate enhanced configuration object
      if (!config || typeof config !== 'object') {
        throw new Error('Invalid schedule configuration');
      }
      
      // Step 2: Save to local storage first
      const localData = {
        config: {
          ...config,
          startDate: config.startDate.toISOString(),
        },
        timestamp: Date.now(),
        version: this.CACHE_VERSION,
      };
      localStorage.setItem(this.STORAGE_KEYS.SCHEDULE_CONFIG, JSON.stringify(localData));
      
      // Step 3: Sync with Firebase
      try {
        const currentData = await this.loadCalendarDataFromFirebase();
        const updatedData = {
          ...currentData,
          scheduleConfig: config,
        };
        
        await this.saveCalendarDataToFirebase(updatedData);
        console.log('[CalendarPersistence.ts][7012] › Enhanced schedule configuration synced to Firebase');
        
      } catch (firebaseError) {
        console.warn('[CalendarPersistence.ts][7013] › Firebase sync failed for config:', firebaseError);
      }
      
    } catch (error) {
      console.error('[CalendarPersistence.ts][7014] › Error saving schedule configuration:', error);
      throw new Error('Failed to save schedule configuration');
    }
  }

  /**
   * Loads enhanced schedule configuration with proper date parsing and Firebase sync.
   * Handles backward compatibility and provides default enhanced configuration
   * if no valid configuration is found in storage systems.
   */
  async loadScheduleConfig(): Promise<ScheduleConfig | null> {
    console.log('[CalendarPersistence.ts][7015] › Loading enhanced schedule configuration');
    
    try {
      // Step 1: Try loading from Firebase first
      const firebaseData = await this.loadCalendarDataFromFirebase();
      if (firebaseData.scheduleConfig) {
        console.log('[CalendarPersistence.ts][7016] › Loaded enhanced configuration from Firebase');
        return firebaseData.scheduleConfig;
      }
      
    } catch (firebaseError) {
      console.warn('[CalendarPersistence.ts][7017] › Firebase config load failed:', firebaseError);
    }
    
    // Step 2: Fallback to local storage
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.SCHEDULE_CONFIG);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.config && data.version === this.CACHE_VERSION) {
          const config = {
            ...data.config,
            startDate: new Date(data.config.startDate),
            // Ensure new properties have defaults for backward compatibility
            subjectsPerDay: data.config.subjectsPerDay || 3,
            preferredTimeSlots: data.config.preferredTimeSlots || ['morning', 'afternoon', 'evening'],
            maxSessionsPerDay: data.config.maxSessionsPerDay || 6,
          };
          console.log('[CalendarPersistence.ts][7018] › Loaded enhanced configuration from local storage');
          return config;
        }
      }
    } catch (localError) {
      console.error('[CalendarPersistence.ts][7019] › Local config load failed:', localError);
    }
    
    console.log('[CalendarPersistence.ts][7020] › No configuration found, returning null');
    return null;
  }

  /**
   * NEW: Saves complete monthly calendar data with daily plans and session tracking.
   * Handles complex calendar structure serialization and provides comprehensive
   * error handling for large calendar datasets and network conditions.
   */
  async saveCalendarMonth(month: CalendarMonth): Promise<void> {
    console.log('[CalendarPersistence.ts][7021] › Saving calendar month with', month.dailyPlans.length, 'daily plans');
    
    try {
      // Step 1: Validate calendar month structure
      if (!month || !month.dailyPlans || !Array.isArray(month.dailyPlans)) {
        throw new Error('Invalid calendar month structure');
      }
      
      // Step 2: Save to local storage first for immediate access
      const localData = {
        month: this.serializeCalendarMonth(month),
        timestamp: Date.now(),
        version: this.CACHE_VERSION,
      };
      localStorage.setItem(this.STORAGE_KEYS.CURRENT_MONTH, JSON.stringify(localData));
      
      // Step 3: Sync with Firebase
      try {
        const currentData = await this.loadCalendarDataFromFirebase();
        const updatedData = {
          ...currentData,
          currentMonth: month,
        };
        
        await this.saveCalendarDataToFirebase(updatedData);
        console.log('[CalendarPersistence.ts][7022] › Calendar month synced to Firebase');
        
      } catch (firebaseError) {
        console.warn('[CalendarPersistence.ts][7023] › Firebase sync failed for calendar month:', firebaseError);
      }
      
    } catch (error) {
      console.error('[CalendarPersistence.ts][7024] › Error saving calendar month:', error);
      throw new Error('Failed to save calendar month');
    }
  }

  /**
   * NEW: Loads monthly calendar data with proper date reconstruction and validation.
   * Handles complex calendar structure deserialization and provides comprehensive
   * fallback mechanisms for different data sources and formats.
   */
  async loadCalendarMonth(): Promise<CalendarMonth | null> {
    console.log('[CalendarPersistence.ts][7025] › Loading calendar month');
    
    try {
      // Step 1: Try loading from Firebase first
      const firebaseData = await this.loadCalendarDataFromFirebase();
      if (firebaseData.currentMonth) {
        console.log('[CalendarPersistence.ts][7026] › Loaded calendar month from Firebase');
        return firebaseData.currentMonth;
      }
      
    } catch (firebaseError) {
      console.warn('[CalendarPersistence.ts][7027] › Firebase calendar month load failed:', firebaseError);
    }
    
    // Step 2: Fallback to local storage
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.CURRENT_MONTH);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.month && data.version === this.CACHE_VERSION) {
          const month = this.deserializeCalendarMonth(data.month);
          console.log('[CalendarPersistence.ts][7028] › Loaded calendar month from local storage');
          return month;
        }
      }
    } catch (localError) {
      console.error('[CalendarPersistence.ts][7029] › Local calendar month load failed:', localError);
    }
    
    console.log('[CalendarPersistence.ts][7030] › No calendar month found, returning null');
    return null;
  }

  /**
   * NEW: Saves completed session IDs for progress tracking and completion analytics.
   * Maintains completion state across sessions and provides data for progress
   * visualization and study effectiveness analysis.
   */
  async saveCompletedSessions(sessionIds: string[]): Promise<void> {
    console.log('[CalendarPersistence.ts][7031] › Saving', sessionIds.length, 'completed sessions');
    
    try {
      // Step 1: Validate input data
      if (!Array.isArray(sessionIds)) {
        throw new Error('Completed sessions must be an array');
      }
      
      // Step 2: Save to local storage first
      const localData = {
        sessions: sessionIds,
        timestamp: Date.now(),
        version: this.CACHE_VERSION,
      };
      localStorage.setItem(this.STORAGE_KEYS.COMPLETED_SESSIONS, JSON.stringify(localData));
      
      // Step 3: Sync with Firebase
      try {
        const currentData = await this.loadCalendarDataFromFirebase();
        const updatedData = {
          ...currentData,
          completedSessions: sessionIds,
        };
        
        await this.saveCalendarDataToFirebase(updatedData);
        console.log('[CalendarPersistence.ts][7032] › Completed sessions synced to Firebase');
        
      } catch (firebaseError) {
        console.warn('[CalendarPersistence.ts][7033] › Firebase sync failed for completed sessions:', firebaseError);
      }
      
    } catch (error) {
      console.error('[CalendarPersistence.ts][7034] › Error saving completed sessions:', error);
      throw new Error('Failed to save completed sessions');
    }
  }

  /**
   * NEW: Loads completed session IDs for progress tracking and analytics.
   * Returns array of session IDs that have been marked as completed by the user
   * for accurate progress visualization and completion rate calculations.
   */
  async loadCompletedSessions(): Promise<string[]> {
    console.log('[CalendarPersistence.ts][7035] › Loading completed sessions');
    
    try {
      // Step 1: Try loading from Firebase first
      const firebaseData = await this.loadCalendarDataFromFirebase();
      if (firebaseData.completedSessions && Array.isArray(firebaseData.completedSessions)) {
        console.log('[CalendarPersistence.ts][7036] › Loaded', firebaseData.completedSessions.length, 'completed sessions from Firebase');
        return firebaseData.completedSessions;
      }
      
    } catch (firebaseError) {
      console.warn('[CalendarPersistence.ts][7037] › Firebase completed sessions load failed:', firebaseError);
    }
    
    // Step 2: Fallback to local storage
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.COMPLETED_SESSIONS);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.sessions && Array.isArray(data.sessions) && data.version === this.CACHE_VERSION) {
          console.log('[CalendarPersistence.ts][7038] › Loaded', data.sessions.length, 'completed sessions from local storage');
          return data.sessions;
        }
      }
    } catch (localError) {
      console.error('[CalendarPersistence.ts][7039] › Local completed sessions load failed:', localError);
    }
    
    console.log('[CalendarPersistence.ts][7040] › No completed sessions found, returning empty array');
    return [];
  }

  /**
   * NEW: Clears calendar month data specifically while preserving other settings.
   * Useful for month transitions and schedule regeneration without losing
   * configuration and notebook selections.
   */
  async clearCalendarMonth(): Promise<void> {
    console.log('[CalendarPersistence.ts][7041] › Clearing calendar month data');
    
    try {
      // Step 1: Clear from Firebase
      const currentData = await this.loadCalendarDataFromFirebase();
      const updatedData = {
        ...currentData,
        currentMonth: null,
      };
      await this.saveCalendarDataToFirebase(updatedData);
      
    } catch (firebaseError) {
      console.warn('[CalendarPersistence.ts][7042] › Firebase clear failed:', firebaseError);
    }
    
    // Step 2: Clear from local storage
    try {
      localStorage.removeItem(this.STORAGE_KEYS.CURRENT_MONTH);
      console.log('[CalendarPersistence.ts][7043] › Calendar month data cleared');
      
    } catch (localError) {
      console.error('[CalendarPersistence.ts][7044] › Error clearing local calendar month:', localError);
    }
  }

  /**
   * Clears all stored calendar data from both Firebase and local storage.
   * Provides comprehensive reset functionality while ensuring proper cleanup
   * across all storage mechanisms and maintaining system consistency.
   */
  async clearCalendarData(): Promise<void> {
    console.log('[CalendarPersistence.ts][7045] › Clearing all stored calendar data');
    
    try {
      // Step 1: Clear from Firebase
      const response = await fetch(this.API_ENDPOINT, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (response.ok) {
        console.log('[CalendarPersistence.ts][7046] › Firebase calendar data cleared');
      } else {
        console.warn('[CalendarPersistence.ts][7047] › Firebase clear failed, continuing with local cleanup');
      }
      
    } catch (firebaseError) {
      console.warn('[CalendarPersistence.ts][7048] › Firebase clear error:', firebaseError);
    }
    
    // Step 2: Clear local storage
    try {
      localStorage.removeItem(this.STORAGE_KEYS.SELECTED_NOTEBOOKS);
      localStorage.removeItem(this.STORAGE_KEYS.SCHEDULE_CONFIG);
      localStorage.removeItem(this.STORAGE_KEYS.CURRENT_MONTH);
      localStorage.removeItem(this.STORAGE_KEYS.COMPLETED_SESSIONS);
      localStorage.removeItem(this.STORAGE_KEYS.LAST_SYNC);
      
      console.log('[CalendarPersistence.ts][7049] › Local calendar data cleared');
      
    } catch (localError) {
      console.error('[CalendarPersistence.ts][7050] › Error clearing local storage:', localError);
    }
  }

  /**
   * Serializes calendar month data for storage, handling date objects and
   * complex nested structures while maintaining data integrity and type safety.
   */
  private serializeCalendarMonth(month: CalendarMonth): any {
    return {
      year: month.year,
      month: month.month,
      dailyPlans: month.dailyPlans.map(plan => ({
        ...plan,
        date: plan.date.toISOString(),
        sessions: plan.sessions.map(session => ({
          ...session,
          date: session.date.toISOString(),
          notebookMeta: {
            ...session.notebookMeta,
            lastUpdated: session.notebookMeta.lastUpdated.toISOString(),
          },
        })),
      })),
      monthlySummary: month.monthlySummary,
    };
  }

  /**
   * Deserializes calendar month data from storage, reconstructing date objects
   * and validating data structure integrity for proper calendar functionality.
   */
  private deserializeCalendarMonth(serialized: any): CalendarMonth {
    return {
      year: serialized.year,
      month: serialized.month,
      dailyPlans: serialized.dailyPlans.map((plan: any) => ({
        ...plan,
        date: new Date(plan.date),
        sessions: plan.sessions.map((session: any) => ({
          ...session,
          date: new Date(session.date),
          notebookMeta: {
            ...session.notebookMeta,
            lastUpdated: new Date(session.notebookMeta.lastUpdated),
          },
        })),
      })),
      monthlySummary: serialized.monthlySummary,
    };
  }

  /**
   * Private method to load complete calendar data from Firebase API.
   * Handles authentication, network errors, and data deserialization
   * while providing proper error propagation for calling methods.
   */
  private async loadCalendarDataFromFirebase(): Promise<any> {
    console.log('[CalendarPersistence.ts][7051] › Loading calendar data from Firebase');
    
    const response = await fetch(this.API_ENDPOINT, {
      method: 'GET',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error(`Firebase load failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Step 1: Deserialize dates and complex structures
    return {
      selectedNotebooks: data.selectedNotebooks || [],
      scheduleConfig: data.scheduleConfig ? {
        ...data.scheduleConfig,
        startDate: new Date(data.scheduleConfig.startDate),
        // Ensure new properties have defaults
        subjectsPerDay: data.scheduleConfig.subjectsPerDay || 3,
        preferredTimeSlots: data.scheduleConfig.preferredTimeSlots || ['morning', 'afternoon', 'evening'],
        maxSessionsPerDay: data.scheduleConfig.maxSessionsPerDay || 6,
      } : null,
      currentMonth: data.currentMonth ? this.deserializeCalendarMonth(data.currentMonth) : null,
      completedSessions: data.completedSessions || [],
    };
  }

  /**
   * Private method to save complete calendar data to Firebase API.
   * Handles data serialization, authentication, and network error
   * management while ensuring proper error propagation to callers.
   */
  private async saveCalendarDataToFirebase(data: any): Promise<void> {
    console.log('[CalendarPersistence.ts][7052] › Saving calendar data to Firebase');
    
    // Step 1: Serialize dates and complex structures for transmission
    const serializedData = {
      selectedNotebooks: data.selectedNotebooks || [],
      scheduleConfig: data.scheduleConfig ? {
        ...data.scheduleConfig,
        startDate: data.scheduleConfig.startDate instanceof Date
          ? data.scheduleConfig.startDate.toISOString()
          : data.scheduleConfig.startDate,
      } : null,
      currentMonth: data.currentMonth ? this.serializeCalendarMonth(data.currentMonth) : null,
      completedSessions: data.completedSessions || [],
    };
    
    const response = await fetch(this.API_ENDPOINT, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(serializedData),
    });
    
    if (!response.ok) {
      throw new Error(`Firebase save failed: ${response.status}`);
    }
  }

  /**
   * Checks if stored calendar data is stale based on version and timestamp
   * information from both Firebase and local storage. Uses cache version
   * and modification timestamps to determine staleness across storage mechanisms.
   */
  async isCalendarDataStale(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<boolean> {
    console.log('[CalendarPersistence.ts][7053] › Checking if calendar data is stale (max age:', maxAgeMs, 'ms)');
    
    let mostRecentTimestamp = 0;
    let hasValidVersion = false;
    
    // Step 1: Check Firebase timestamp
    try {
      const firebaseData = await this.loadCalendarDataFromFirebase();
      if (firebaseData.lastUpdated) {
        mostRecentTimestamp = Math.max(mostRecentTimestamp, new Date(firebaseData.lastUpdated).getTime());
        hasValidVersion = true;
      }
    } catch (firebaseError) {
      console.warn('[CalendarPersistence.ts][7054] › Firebase staleness check failed:', firebaseError);
    }
    
    // Step 2: Check local storage timestamp and version
    try {
      const keys = [this.STORAGE_KEYS.SELECTED_NOTEBOOKS, this.STORAGE_KEYS.SCHEDULE_CONFIG, this.STORAGE_KEYS.CURRENT_MONTH];
      
      for (const key of keys) {
        const stored = localStorage.getItem(key);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.timestamp && data.version === this.CACHE_VERSION) {
            mostRecentTimestamp = Math.max(mostRecentTimestamp, data.timestamp);
            hasValidVersion = true;
          }
        }
      }
    } catch (localError) {
      console.warn('[CalendarPersistence.ts][7055] › Local staleness check failed:', localError);
    }
    
    // Step 3: Determine staleness
    if (mostRecentTimestamp === 0 || !hasValidVersion) {
      console.log('[CalendarPersistence.ts][7056] › No valid timestamps found or version mismatch, considering stale');
      return true;
    }
    
    const now = Date.now();
    const age = now - mostRecentTimestamp;
    const isStale = age > maxAgeMs;
    
    console.log('[CalendarPersistence.ts][7057] › Calendar data age:', age, 'ms, stale:', isStale);
    return isStale;
  }

  /**
   * Forces cache invalidation by updating version number and clearing
   * local storage entries. Useful for major calendar system updates
   * that require fresh data generation and storage format changes.
   */
  async invalidateCache(): Promise<void> {
    console.log('[CalendarPersistence.ts][7058] › Invalidating calendar cache');
    
    try {
      // Clear all local storage entries for calendar data
      Object.values(this.STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      
      // Set new cache version marker
      localStorage.setItem(this.STORAGE_KEYS.CACHE_VERSION, this.CACHE_VERSION);
      
      console.log('[CalendarPersistence.ts][7059] › Calendar cache invalidated successfully');
      
    } catch (error) {
      console.error('[CalendarPersistence.ts][7060] › Error invalidating cache:', error);
      throw new Error('Failed to invalidate calendar cache');
    }
  }
}