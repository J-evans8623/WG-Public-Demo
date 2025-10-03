// src/services/study-planner/constants/schedulingConstants.ts
/**
 * @file schedulingConstants.ts
 * @description
 * [Responsibility & Scope]
 * This file centralizes the Study Planner’s tunable “magic numbers” and semantic IDs into
 * a single, well-documented module. By extracting constants from business logic we avoid
 * scattering implicit assumptions across the codebase and enable safe, focused changes to
 * the scheduling behavior without refactors. Each exported constant includes a comment that
 * explains its effect on the algorithm, its default rationale, and downstream consumers that
 * rely on it. These values are consumed by utilities (e.g., duration estimation), core
 * schedulers (e.g., day offsets for revisions), and the orchestrator (e.g., chunk size).
 * All values are pure and side-effect free. Adjusting them is cheap and deterministic,
 * improving testability and long-term maintainability in production environments.
 */

/** Number of units per session-sized chunk. Impacts parsing and learning progression. */
export const DEFAULT_CHUNK_SIZE = 3;

/** Max notebooks per learning set; enforced by distributor and used by schedulers. */
export const MAX_NOTEBOOKS_PER_LEARNING_SET = 3;

/** Interleaved quota multiplier: total sessions required = lessons * multiplier. */
export const INTERLEAVED_REVISION_MULTIPLIER = 3;

/** Days after lesson completion when the first interleaved session begins. */
export const INTERLEAVED_START_DELAY_DAYS = 3;

/** Days between interleaved sessions (cadence). */
export const INTERLEAVED_INTERVAL_DAYS = 3;

/** Block revision must occur the day after its corresponding learning block. */
export const BLOCK_REVISION_DELAY_DAYS = 1;

/** Baseline minutes per lesson unit; used for learning block duration estimation. */
export const ESTIMATED_MINUTES_PER_UNIT = 10;

/** Multiplier to shorten revision blocks vs. learning blocks (less content density). */
export const REVISION_BLOCK_DURATION_MULTIPLIER = 0.8;

/** A simple default for interleaved session length when unit-count is variable. */
export const INTERLEAVED_SESSION_MINUTES = 20;

/** ID prefixes to help with debugging and analytics. */
export const ID_PREFIX = {
  SESSION: 'SPS', // Study Planner Session
  LESSON: 'SPL',  // Study Planner Lesson
  LSET: 'LS',     // Learning Set
} as const;
