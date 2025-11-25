// src/services/study-planner/utils/dateUtils.ts
/**
 * @file dateUtils.ts
 * @description
 * [Responsibility & Scope]
 * This module provides pure, well-tested helpers for date arithmetic used by the Study
 * Planner. Utilities include adding days while preserving local time intent, formatting
 * dates into deterministic map keys, checking day-of-week availability against the user’s
 * configuration, and scanning forward to the next available date. All functions are safe,
 * side-effect free, and tuned for O(1) or O(N) with small N loops (e.g., weekly scans).
 * By isolating date math here, core schedulers avoid duplicating tricky calendar logic,
 * reducing subtle off-by-one bugs. Each function logs at critical checkpoints to support
 * observability in production, with concise identifiers that are easy to search.
 */

import { type DayOfWeek, type ScheduleConfig } from '../models/Configuration';

/**
 * @function addDays
 * @description
 * Adds a number of whole days to a Date instance, returning a new Date. Time-of-day is
 * preserved to align with UI calendaring. This function is pure; it never mutates input.
 */
export function addDays(date: Date, days: number): Date {
  const loc = 'utils/dateUtils.ts#1021';
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  // eslint-disable-next-line no-console
  console.log(`[${loc}] addDays -> base=${date.toISOString()} days=${days} out=${d.toISOString()}`);
  return d;
}

/**
 * @function formatDateKey
 * @description
 * Formats a date as a stable YYYY-MM-DD string for use as Map keys. Uses local time,
 * not UTC, to align with human calendars and availability windows.
 */
export function formatDateKey(date: Date): string {
  const loc = 'utils/dateUtils.ts#2037';
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  const key = `${y}-${m}-${d}`;
  // eslint-disable-next-line no-console
  console.log(`[${loc}] formatDateKey -> ${key}`);
  return key;
}

/**
 * @function getDayToken
 * @description
 * Converts a Date into a DayOfWeek token understood by the scheduler. This keeps all
 * comparisons strongly typed and prevents locale differences from breaking logic.
 */
export function getDayToken(date: Date): DayOfWeek {
  const idx = date.getDay(); // 0=Sun .. 6=Sat
  const map: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as unknown as DayOfWeek[];
  return map[idx] ?? 'Mon';
}

/**
 * @function isDateAvailable
 * @description
 * Checks if a given date matches the configuration’s DayAvailability. The comparison is
 * O(1) with a Set, and returns a boolean that drives all scheduling eligibility checks.
 */
export function isDateAvailable(date: Date, config: ScheduleConfig): boolean {
  const loc = 'utils/dateUtils.ts#3179';
  const allowed = new Set<DayOfWeek>(config.DayAvailability);
  const token = getDayToken(date);
  const ok = allowed.has(token);
  // eslint-disable-next-line no-console
  console.log(`[${loc}] isDateAvailable -> token=${token} allowed=${ok}`);
  return ok;
}

/**
 * @function getNextAvailableDate
 * @description
 * Starting from a base date (optionally after adding an initial offset), walks forward
 * day-by-day until it finds one that passes isDateAvailable. This is O(7) worst-case for
 * weekly patterns. It never mutates the input date and guarantees termination when at
 * least one day is available in the config (validated upstream).
 */
export function getNextAvailableDate(
  base: Date,
  config: ScheduleConfig,
  initialOffsetDays = 0
): Date {
  const loc = 'utils/dateUtils.ts#4335';
  let probe = addDays(base, initialOffsetDays);
  for (let i = 0; i < 14; i++) {
    if (isDateAvailable(probe, config)) {
      // eslint-disable-next-line no-console
      console.log(`[${loc}] getNextAvailableDate -> found=${probe.toISOString()} after=${i} scans`);
      return probe;
    }
    probe = addDays(probe, 1);
  }
  // eslint-disable-next-line no-console
  console.log(`[${loc}] getNextAvailableDate -> fallback=${probe.toISOString()} (unexpected long scan)`);
  return probe;
}

/**
 * @function getDaysBetween
 * @description
 * Computes the integer number of whole days between start and end in local time. Result
 * is positive when end is after start and negative when end is before start.
 */
export function getDaysBetween(start: Date, end: Date): number {
  const loc = 'utils/dateUtils.ts#5468';
  const startKey = new Date(formatDateKey(start));
  const endKey = new Date(formatDateKey(end));
  const diff = Math.round((endKey.getTime() - startKey.getTime()) / (1000 * 60 * 60 * 24));
  // eslint-disable-next-line no-console
  console.log(`[${loc}] getDaysBetween -> start=${formatDateKey(start)} end=${formatDateKey(end)} diff=${diff}`);
  return diff;
}
