// src/services/study-planner/models/Configuration.ts
/**
 * @file Configuration.ts
 * @description
 * [Responsibility & Scope]
 * This file declares and documents the schedule configuration model for the Study Planner
 * Service. The core algorithm requires an availability pattern that constrains which days
 * may host learning set activity. We therefore define DayOfWeek for clarity and provide a
 * strongly-typed ScheduleConfig with a DayAvailability array. While future phases may add
 * richer controls—such as time-slot preferences, per-day maximums, or blackout windows—the
 * present model keeps the public API minimal and stable. Centralizing configuration types
 * here ensures every component consumes the same contract, improving testability and
 * reducing drift. These interfaces remain intentionally behavior-free; the utilities that
 * interpret and validate them (e.g., availability checks and next-available-day search)
 * are introduced in later phases, keeping responsibilities clean and modular.
 */

/** Canonical day-of-week tokens used by the scheduler. */
export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';



export const ALL_DAYS: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/**
 * Minimal schedule configuration required by the service.
 * Additional fields (like time windows) can be safely added in future phases.
 */
export interface ScheduleConfig {
  /**
   * Array of allowed days for scheduling (e.g., ['Mon', 'Wed', 'Fri']).
   * The algorithm treats this as a repeating weekly pattern starting from startDate.
   */
  DayAvailability: DayOfWeek[];
}

/** * Default configuration ensuring the planner starts with a full week enabled.
 * Use this constant to initialize your CalendarContext state.
 */
export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  DayAvailability: ALL_DAYS,
};

/** Re-export for convenience from the models barrel. */
export type { ScheduleConfig as DefaultScheduleConfig };
