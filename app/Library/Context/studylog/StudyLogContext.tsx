// StudyLogContext.tsx

/**
 * @file app/Library/Context/StudyLogContext.tsx
 * @description
 * Client-side state management for the Study Log feature.
 *
 * Phase 2 Refactor:
 * - Removed chronological history tracking (`recentSessions`) and `logSessionComplete`.
 * Session counts are now derived from the Calendar, and history is aggregated.
 * - Updated `logTime` to perform granular aggregation into `notebookStats`.
 * - Updated `checkWeeklyReset` to handle the new nested map structure.
 *
 * Responsibilities:
 * 1. Hydration: Loads aggregated stats from localStorage.
 * 2. Synchronization: Fetches fresh summary from API, resolving conflicts via `resolveMostRecent`.
 * 3. Buffered Persistence: Flushes updated summary to the API at a controlled interval.
 * 4. Tracking: Exposes `logTime` to accumulate study duration per notebook.
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import {
  StudyLogSummary,
  DEFAULT_STUDY_LOG,
  NotebookStudyStats
} from '@/app/Library/Definitions/StudyLogDefinitions';
import { resolveMostRecent, getWeekStartTimestamp } from '@/app/src/services/study-log/StudyLogUtils';

// --- Constants ---
const STORAGE_KEY = 'bloom_study_log_v1';
const SYNC_INTERVAL_MS = 60 * 1000; // Check for pending writes every 1 minute
const WRITE_THROTTLE_MS = 10 * 60 * 1000; // Allow network write only every 10 minutes

interface StudyLogContextValue {
  summary: StudyLogSummary;
  isLoading: boolean;
  /**
   * Logs a completed study session or slide duration.
   * Updates the global and per-notebook counters.
   * @param durationSeconds - The valid duration (after heuristics).
   * @param notebookId - The ID of the notebook being studied.
   */
  logTime: (durationSeconds: number, notebookId: string) => void;
}

const StudyLogContext = createContext<StudyLogContextValue | undefined>(undefined);

export const StudyLogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // --- State ---
  const [summary, setSummary] = useState<StudyLogSummary>(DEFAULT_STUDY_LOG);
  const [isLoading, setIsLoading] = useState(true);

  // --- Refs for Buffering & Throttling ---
  const isDirty = useRef(false);
  const lastWriteTime = useRef<number>(0);
  const hasInitialSync = useRef(false);

  // --- Helpers ---

  /**
   * 1. Persistence Helper: Save current state to LocalStorage
   */
  const persistToLocal = useCallback((data: StudyLogSummary) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[StudyLogContext] Failed to save to localStorage', e);
    }
  }, []);

  /**
   * 2. Reset Weekly Stats if a new week has started
   * update - 1: Now resets nested notebookStats weekly counters
   */
  const checkWeeklyReset = useCallback((data: StudyLogSummary): StudyLogSummary => {
    const currentWeekStart = getWeekStartTimestamp();
    
    // If the data is from a previous week, we must reset weekly counters
    if (data.currentWeekStart < currentWeekStart) {
      console.log('[StudyLogContext] New week detected. Resetting weekly counters.');
      
      const resetStats: Record<string, NotebookStudyStats> = {};
      
      // Iterate over existing notebooks and reset their weekly counter to 0
      // while preserving their all-time total.
      if (data.notebookStats) {
        Object.keys(data.notebookStats).forEach(id => {
          const prev = data.notebookStats[id];
          resetStats[id] = {
            ...prev,
            weekly: 0
            // We don't change lastUpdated here; strict updates happen on activity
          };
        });
      }

      return {
        ...data,
        currentWeekStart,
        weeklyStudySeconds: 0,
        weeklySessionsCompleted: 0, // Legacy field, kept for schema compliance but effectively unused
        notebookStats: resetStats,
      };
    }
    return data;
  }, []);

  // --- Effects ---

  /**
   * Effect 1: Hydration & Initial Network Sync
   * Runs once on mount.
   */
  useEffect(() => {
    const init = async () => {
      // A. Local Hydration
      let localData: StudyLogSummary | null = null;

      try {
        const rawSummary = localStorage.getItem(STORAGE_KEY);

        if (rawSummary) {
          localData = JSON.parse(rawSummary);
          if (localData) {
            // Apply logic immediately to show correct "This Week" stats
            localData = checkWeeklyReset(localData);
            
            // Migration: Ensure notebookStats exists
            if (!localData.notebookStats) {
              localData.notebookStats = {};
            }
            
            setSummary(localData);
          }
        }
        
        if (localData) setIsLoading(false); // Show cached data immediately

      } catch (e) {
        console.warn('[StudyLogContext] Local hydration failed', e);
      }

      // If no cache, we are still loading (ghost state)
      if (!localData) setIsLoading(true);

      // B. Network Sync
      if (hasInitialSync.current) return;
      hasInitialSync.current = true;

      try {
        const res = await fetch('/api/studylog/sync', { method: 'GET' });
        if (res.ok) {
          const { summary: remoteData } = await res.json();
          
          // Conflict Resolution: Last Update Wins (with granular merge logic in util)
          const merged = resolveMostRecent(localData, remoteData);
          const final = checkWeeklyReset(merged);

          setSummary(final);
          persistToLocal(final);
        } else {
           console.warn('[StudyLogContext] Initial sync failed', res.status);
        }
      } catch (e) {
        console.error('[StudyLogContext] Network error during initial sync', e);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [checkWeeklyReset, persistToLocal]);

  /**
   * Effect 2: The Buffered Write Loop
   * update - 2: Simplified to only send summary (removed pendingSessions)
   */
  const summaryRef = useRef(summary);
  useEffect(() => { summaryRef.current = summary; }, [summary]);

  useEffect(() => {
    const flushData = async () => {
        const now = Date.now();
        const timeSinceLastWrite = now - lastWriteTime.current;
        const shouldFlush = isDirty.current && (timeSinceLastWrite > WRITE_THROTTLE_MS);

        if (!shouldFlush) return;

        const currentSummary = summaryRef.current;

        try {
            const res = await fetch('/api/studylog/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    summary: currentSummary,
                    newSessions: [] // update - 3: We no longer track history arrays here
                })
            });

            if (res.ok) {
                console.log('[StudyLogContext] Buffered write successful');
                lastWriteTime.current = Date.now();
                isDirty.current = false;
            } else {
                console.warn('[StudyLogContext] Buffered write failed', res.status);
            }
        } catch (e) {
            console.error('[StudyLogContext] Buffered write network error', e);
        }
    };

    const intervalId = setInterval(flushData, SYNC_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, []); 


  // --- Actions ---

  /**
   * update - 4: Aggregates time into global and per-notebook stats.
   */
  const logTime = useCallback((durationSeconds: number, notebookId: string) => {
    setSummary(prev => {
      const now = Date.now();
      // Ensure we are working with fresh weekly boundaries
      const updated = checkWeeklyReset({ ...prev });

      // 1. Global Aggregates
      updated.totalStudySeconds += durationSeconds;
      updated.weeklyStudySeconds += durationSeconds;
      updated.lastUpdated = now;
      
      // 2. Notebook-Specific Aggregates
      if (!updated.notebookStats) updated.notebookStats = {};
      
      const currentStats = updated.notebookStats[notebookId] || { weekly: 0, total: 0, lastUpdated: 0 };
      
      updated.notebookStats[notebookId] = {
        weekly: currentStats.weekly + durationSeconds,
        total: currentStats.total + durationSeconds,
        lastUpdated: now
      };

      persistToLocal(updated);
      return updated;
    });

    isDirty.current = true;
  }, [checkWeeklyReset, persistToLocal]);

  // logSessionComplete removed per Phase 2 requirements.

  const value = {
    summary,
    isLoading,
    logTime
  };

  return (
    <StudyLogContext.Provider value={value}>
      {children}
    </StudyLogContext.Provider>
  );
};

export const useStudyLog = () => {
  const ctx = useContext(StudyLogContext);
  if (!ctx) throw new Error('useStudyLog must be used within StudyLogProvider');
  return ctx;
};