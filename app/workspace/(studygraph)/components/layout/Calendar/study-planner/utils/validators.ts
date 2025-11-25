/**
 * @file services/study-planner/utils/validators.ts
 * @description
 * [Responsibility & Scope]
 * This module exposes defensive, pure validation helpers used by the Study Planner Service
 * to fail fast on malformed inputs before orchestration and scheduling proceed. The functions
 * here validate the core inputs that flow through the system: (1) the weekly schedule
 * configuration with its availability tokens, (2) the plan start date as a real, non-past
 * Date instance, (3) lesson units inside notebooks to guarantee required fields are present
 * for parsing/chunking, and (4) the notebooks collection itself to ensure every notebook
 * contains a minimal, coherent shape. Each function throws actionable errors that name the
 * failing field and index to speed up debugging, and emits concise, purposeful console logs
 * that include a file reference plus a unique 4-digit code (searchable across logs). All
 * validators are side-effect free (apart from logging) and complete in O(N) where N is the
 * number of items being validated, ensuring negligible overhead even for large inputs.
 */

import type {
  NotebookMeta,
  LessonUnit,
} from '@/app/Library/Definitions/CalendarDefinitions';
import type { ScheduleConfig, DayOfWeek } from '../models/Configuration';
import { validateLessonUnit as baseValidateLessonUnit } from './lessonUtils';

// update - 1
/** Allowed tokens for availability; kept here to validate user config. */
const DAY_TOKENS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// update - 2
/**
 * @function validateScheduleConfig
 * @description
 * Validates that the provided ScheduleConfig is structurally sound and actionable by the
 * scheduler. It ensures DayAvailability exists, is an array with at least one entry, and
 * that all entries are valid DayOfWeek tokens. It also checks for duplicate tokens and will
 * normalize by verifying uniqueness (duplicates are rejected to avoid ambiguity). This
 * function throws an Error with a descriptive message on failure to encourage early fixes,
 * and emits a single log line indicating pass/fail for observability.
 * @param config The candidate configuration object to validate.
 * @throws Error when the configuration is missing, malformed, empty, or contains invalid tokens.
 */
export function validateScheduleConfig(config: ScheduleConfig): void {
  const loc = 'utils/validators.ts#1201';
  if (!config || !Array.isArray(config.DayAvailability)) {
    // eslint-disable-next-line no-console
    console.log(`[${loc}] validateScheduleConfig -> FAIL (missing/invalid DayAvailability)`);
    throw new Error('ScheduleConfig.DayAvailability must be a non-empty array of day tokens.');
  }

  const days = config.DayAvailability;
  if (days.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`[${loc}] validateScheduleConfig -> FAIL (empty availability)`);
    throw new Error('ScheduleConfig.DayAvailability must include at least one available day.');
  }

  const allowed = new Set<DayOfWeek>(DAY_TOKENS);
  const seen = new Set<string>();
  for (let i = 0; i < days.length; i++) {
    const d = days[i] as DayOfWeek;
    if (!allowed.has(d)) {
      // eslint-disable-next-line no-console
      console.log(`[${loc}] validateScheduleConfig -> FAIL (invalid token "${String(d)}" at index ${i})`);
      throw new Error(`ScheduleConfig.DayAvailability has invalid token "${String(d)}" at index ${i}.`);
    }
    if (seen.has(d)) {
      // eslint-disable-next-line no-console
      console.log(`[${loc}] validateScheduleConfig -> FAIL (duplicate token "${d}")`);
      throw new Error(`ScheduleConfig.DayAvailability contains duplicate token "${d}". Use unique days only.`);
    }
    seen.add(d);
  }

  // eslint-disable-next-line no-console
  console.log(`[${loc}] validateScheduleConfig -> PASS days=${days.join(',')}`);
}

// update - 3
/**
 * @function validateStartDate
 * @description
 * Ensures the given startDate is a real Date instance (not a string or timestamp), is not
 * NaN, and is not in the past relative to the user’s local clock (midnight granularity).
 * Rejecting past dates avoids generating plans whose first actions are already missed and
 * keeps block/revision alternation coherent from day zero. If you need to allow past dates
 * for backfilling, adapt this validator accordingly. On failure, an Error is thrown with a
 * clear explanation and the offending value is included for debugging.
 * @param startDate The proposed plan start date.
 * @throws Error when startDate is not a valid Date or resolves to a prior calendar day.
 */
export function validateStartDate(startDate: Date): void {
  const loc = 'utils/validators.ts#1202';
  if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) {
    // eslint-disable-next-line no-console
    console.log(`[${loc}] validateStartDate -> FAIL (invalid Date instance)`);
    throw new Error('startDate must be a valid Date instance.');
  }

  // Compare at day precision in local time.
  const todayKey = new Date(formatYMD(new Date()));
  const startKey = new Date(formatYMD(startDate));
  if (startKey.getTime() < todayKey.getTime()) {
    // eslint-disable-next-line no-console
    console.log(`[${loc}] validateStartDate -> FAIL (date is in the past) start=${startKey.toISOString()} today=${todayKey.toISOString()}`);
    throw new Error('startDate must be today or a future date.');
  }

  // eslint-disable-next-line no-console
  console.log(`[${loc}] validateStartDate -> PASS start=${startKey.toISOString()}`);
}

// update - 4
/**
 * @function validateLessonUnit
 * @description
 * Thin wrapper that delegates to the canonical unit validator in lessonUtils to keep a
 * single source of truth for field-level checks. This exists so callers that import only
 * validators.ts can still validate units without importing multiple modules. The delegated
 * validator throws errors on invalid shapes and logs a concise PASS/FAIL message that is
 * searchable via its unique code. This wrapper preserves that behavior.
 * @param unit Unknown value to validate as LessonUnit.
 * @param context Optional context string to enrich error/log messages.
 * @throws Error when the unit is malformed as per lessonUtils.
 */
export function validateLessonUnit(unit: unknown, context?: string): asserts unit is LessonUnit {
  baseValidateLessonUnit(unit, context ?? 'validators.validateLessonUnit');
}

// update - 5
/**
 * @function validateNotebooks
 * @description
 * Validates an array of NotebookMeta objects for structural integrity before scheduling.
 * The function enforces: (1) the array is non-empty, (2) each notebook exposes required
 * fields (fileId, fileName, lessonUnits array), (3) each lesson unit passes the shared unit
 * validator, and (4) rudimentary type checks for strings/arrays. The pass is linear time
 * O(N) over the total lesson unit count. On any failure it throws with the offending index
 * and a clear description, enabling quick fixes during integration.
 * @param notebooks Candidate array of NotebookMeta to validate.
 * @throws Error when notebooks is empty, a notebook is malformed, or a unit fails validation.
 */
export function validateNotebooks(notebooks: NotebookMeta[]): void {
  const loc = 'utils/validators.ts#1203';

  if (!Array.isArray(notebooks) || notebooks.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`[${loc}] validateNotebooks -> FAIL (empty or non-array)`);
    throw new Error('notebooks must be a non-empty array of NotebookMeta.');
    }

  let totalUnits = 0;

  for (let i = 0; i < notebooks.length; i++) {
    const nb = notebooks[i] as Partial<NotebookMeta>;

    // Basic shape checks
    const hasId = typeof nb.fileId === 'string' && nb.fileId.trim().length > 0;
    const hasName = typeof nb.fileName === 'string' && nb.fileName.trim().length > 0;
    const hasUnits = Array.isArray((nb as any).lessonUnits);

    if (!hasId || !hasName || !hasUnits) {
      // eslint-disable-next-line no-console
      console.log(
        `[${loc}] validateNotebooks -> FAIL (shape) index=${i} hasId=${hasId} hasName=${hasName} hasUnits=${hasUnits}`
      );
      throw new Error(`Notebook at index ${i} is missing required fields (fileId, fileName, lessonUnits).`);
    }

    const units = (nb as any).lessonUnits as unknown[];
    for (let u = 0; u < units.length; u++) {
      // Will throw on failure with its own message/logging.
      baseValidateLessonUnit(units[u], `validateNotebooks.nb[${i}].unit[${u}]`);
    }
    totalUnits += units.length;
  }

  // eslint-disable-next-line no-console
  console.log(`[${loc}] validateNotebooks -> PASS notebooks=${notebooks.length} units=${totalUnits}`);
}

// update - 6
/* ---------------------------------- Helpers ---------------------------------- */

/**
 * @function formatYMD
 * @description
 * Formats a Date to local YYYY-MM-DD (used for day-precision comparisons). Kept private
 * to this module to avoid cross-module import cycles with dateUtils.
 */
function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}
