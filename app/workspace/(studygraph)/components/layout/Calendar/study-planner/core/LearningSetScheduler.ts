/**
 * @file LearningSetScheduler.ts
 * @description
 * [Responsibility & Scope]
 * This module implements the day-to-learning-set assignment logic for the Study Planner.
 * It answers two critical questions: (1) “Is the date allowed for scheduling according
 * to the user’s DayAvailability?” and, if so, (2) “Which LearningSet should be active
 * on that date?” The scheduler guarantees spacing rules that keep the block-revision
 * mechanism viable. With multiple learning sets, it alternates them in round-robin
 * order across *available* days only. With a single learning set, it activates the
 * set on every *other* available day, ensuring that a block learning session on an
 * available day is followed by the corresponding block revision on the next available
 * day, and then the next learning block occurs one available day later (i.e., never
 * learning and its matching revision on the same date). The public API exposes:
 * (a) getLearningSetForDay — compute the active set for a 0-based available-day index,
 * and (b) buildSchedulePattern — a date-indexed map of assignments over a range.
 * All operations are pure, deterministic, and O(N) in the number of days scanned.
 * Logging is concise and marks critical checkpoints to aid observability in production.
 */

import type { LearningSet } from '../models/LearningSet';
import type { ScheduleConfig } from '../models/Configuration';
import { addDays, formatDateKey, isDateAvailable } from '../utils/dateUtils';

/**
 * @function getLearningSetForDay
 * @description
 * Determines which learning set should be active on a given *available-day index*.
 * For multiple learning sets, this is a simple round-robin using modulo arithmetic.
 * For a single learning set, it activates on even available-day indices only, leaving
 * odd indices as “revision-only” days. This preserves the invariant that a block
 * learning session (even index) is always followed by its block revision on the next
 * available day (odd index), preventing same-day learning & revision. The function
 * does not examine the actual Date — callers provide a 0-based count of *available*
 * days encountered so far. Runs in O(1) time and has no side effects.
 */
export function getLearningSetForDay(
  availableDayIndex: number,
  learningSets: LearningSet[],
  _config: ScheduleConfig
): LearningSet | null {
  const loc = 'core/LearningSetScheduler.ts#3101';
  if (!Array.isArray(learningSets) || learningSets.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`[${loc}] getLearningSetForDay -> FAIL (no learning sets)`);
    return null;
  }

  if (learningSets.length === 1) {
    // Single set: return it only on even available-day indices (0, 2, 4, …).
    const active = availableDayIndex % 2 === 0 ? learningSets[0] : null;
    // eslint-disable-next-line no-console
    console.log(
      `[${loc}] getLearningSetForDay -> single-set idx=${availableDayIndex} active=${!!active}`
    );
    return active;
  }

  // Multiple sets: round-robin across learning sets using available-day index.
  const idx = availableDayIndex % learningSets.length;
  const active = learningSets[idx];
  // eslint-disable-next-line no-console
  console.log(
    `[${loc}] getLearningSetForDay -> multi-set idx=${availableDayIndex} chosen=${active?.id ?? 'none'}`
  );
  return active ?? null;
}

/**
 * @function buildSchedulePattern
 * @description
 * Builds a date→LearningSet assignment map for a given span starting from startDate.
 * The algorithm scans forward day by day, *skipping* any dates that are not allowed
 * by DayAvailability. For each available day, it increments an internal available-day
 * counter (0-based) and determines the active LearningSet by delegating to
 * getLearningSetForDay. If multiple learning sets exist, the map alternates them in
 * a repeating round-robin pattern. If exactly one learning set exists, the map will
 * activate it on every *other* available day (even indices) to protect the revision
 * rule. The map only includes entries for available days; unavailable days are omitted.
 * Time complexity is O(D) where D is the number of days scanned; membership lookups and
 * key formatting are O(1). The function is pure and safe to call repeatedly.
 */
export function buildSchedulePattern(
  startDate: Date,
  learningSets: LearningSet[],
  config: ScheduleConfig,
  totalDays: number
): Map<string, LearningSet> {
  const loc = 'core/LearningSetScheduler.ts#3102';
  const pattern = new Map<string, LearningSet>();
  let availableIdx = 0;

  for (let offset = 0; offset < totalDays; offset++) {
    const date = addDays(startDate, offset);
    if (!isDateAvailable(date, config)) continue;

    const set = getLearningSetForDay(availableIdx, learningSets, config);
    if (set) {
      const key = formatDateKey(date);
      pattern.set(key, set);
    }
    availableIdx++;
  }

  // eslint-disable-next-line no-console
  console.log(
    `[${loc}] buildSchedulePattern -> PASS days=${totalDays} mapped=${pattern.size} sets=${learningSets.length}`
  );
  return pattern;
}
