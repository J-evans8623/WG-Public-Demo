// StudyLogDefinitions.ts

/**
 * @file app/Library/Definitions/StudyLogDefinitions.ts
 * @description
 * Defines the core data structures for the Study Log persistence layer.
 * These interfaces dictate how study statistics are structured in Firestore and
 * managed within the application state.
 *
 * Phase 1 Update: Refactored to support Notebook-Centric Tracking.
 * We have replaced the daily breakdown array with a `notebookStats` map.
 * This structure allows us to track cumulative study time per notebook (both weekly
 * and all-time) to power the "Distribution List" view, providing higher value
 * insights than the previous chronological chart.
 *
 * The `StudyLogSession` interface remains for the time being to support
 * legacy history data if needed, but the primary aggregation logic now moves
 * to the `notebookStats` map in the Summary document.
 */

// We use number for timestamps to ensure serializability across Redux/Context/Storage
// regardless of the underlying Firestore Timestamp object type.

/**
 * Granular record of a single completed study activity.
 * Stored in the `session_history` sub-collection to prevent the main summary document
 * from exceeding size limits over time.
 */
export interface StudyLogSession {
  /** Unique ID (UUID or Firestore AutoID) */
  id: string;
  /** Unix timestamp (ms) when the session started */
  startTime: number;
  /** Unix timestamp (ms) when the session ended */
  endTime: number;
  /**
   * Total valid study time in seconds.
   * This value is the sum of all slide durations that have been filtered
   * through the "Word Count / Question Count" upper-bound heuristic.
   */
  durationSeconds: number;
  /** ID of the notebook studied */
  notebookId: string;
}

/**
 * Statistics for a single notebook.
 * Used within the `notebookStats` map.
 */
export interface NotebookStudyStats {
  /** Cumulative seconds studied for this notebook during the current week */
  weekly: number;
  /** Cumulative seconds studied for this notebook since tracking began */
  total: number;
  /** Timestamp of the last update to this specific notebook's stats */
  lastUpdated: number;
}

/**
 * Aggregated statistics for quick retrieval on the Homescreen.
 * Stored as a singleton document `study_stats/summary` for the user.
 */
export interface StudyLogSummary {
  /** Total study time in seconds since account creation */
  totalStudySeconds: number;
  /** Total number of distinct sessions completed */
  totalSessionsCompleted: number;

  /**
   * Unix timestamp (ms) representing the start of the current tracking week.
   * Used to detect if the `weekly*` counters are stale and need resetting.
   */
  currentWeekStart: number;

  /** Study time in seconds for the current week */
  weeklyStudySeconds: number;
  /** Number of sessions completed in the current week */
  weeklySessionsCompleted: number;

  /**
   * Aggregated study stats per notebook.
   * Key: Notebook ID (string)
   * Value: Stats object { weekly, total, lastUpdated }
   * * update - 1: Replaces `weeklyDailyBreakdown`.
   */
  notebookStats: Record<string, NotebookStudyStats>;

  /**
   * Timestamp of the last write operation.
   * Critical for the "Last Update Wins" synchronization policy.
   */
  lastUpdated: number;
}

/**
 * Default empty state for a new user or a reset cache.
 */
export const DEFAULT_STUDY_LOG: StudyLogSummary = {
  totalStudySeconds: 0,
  totalSessionsCompleted: 0,
  currentWeekStart: 0, // Will be updated on first load logic
  weeklyStudySeconds: 0,
  weeklySessionsCompleted: 0,
  notebookStats: {}, // update - 1: Initialize empty map
  lastUpdated: 0,
};