// src/services/study-planner/types/index.ts
/**
 * @file types/index.ts
 * @description
 * [Responsibility & Scope]
 * This file centralizes lightweight type utilities, union types, branded aliases, and safe
 * runtime type guards used throughout the Study Planner Service. By colocating these helpers,
 * we reduce duplication and make it clear which shapes are considered part of the public
 * domain of the study-planner subsystem. The unions (SessionType, LessonStatus) ensure a
 * constrained, explicit vocabulary for session/lesson states. The branded DateString alias
 * prevents accidental mixing of human-readable strings with map keys, improving correctness
 * in date-indexed maps. Finally, the type guards provide defensive checks at runtime and
 * ship with minimal, purposeful logging statements that assist in observability during
 * integration and debugging without spamming logs. All helpers are written for O(1) checks,
 * preferring structural, fail-fast validation to keep hot paths efficient.
 */

import type { StudySession } from "@/app/Library/Definitions/CalendarDefinitions";

/** Union describing all supported study session categories. */
export type SessionType = 'block' | 'revision-block' | 'revision-interleaved';

/** Union describing the lifecycle state of a lesson. */
export type LessonStatus = 'not-started' | 'in-progress' | 'completed';

/**
 * Branded string for YYYY-MM-DD date keys stored in maps.
 * This prevents accidental misuse of arbitrary strings as date keys.
 */
export type DateString = string & { __brand: 'DateString' };

/** A shallow read-only utility that communicates intent on public APIs. */
export type ReadonlyShallow<T> = {
  readonly [K in keyof T]: T[K];
};

/** Deep readonly utility helpful for state snapshots. */
export type DeepReadonly<T> = T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

/** Utility for representing strictly non-empty arrays. */
export type NonEmptyArray<T> = [T, ...T[]];

/**
 * @function isStudySession
 * @description
 * Step 1) Validates that an unknown input structurally matches the StudySession shape.
 * Step 2) Performs O(1) checks for presence and primitive types on critical fields
 *         (id, type, date), avoiding expensive deep validation.
 * Step 3) Emits a concise console message for observability indicating pass/fail with
 *         a unique code for searchability. This helps trace malformed data early in
 *         orchestration flows without polluting logs in tight loops.
 */
export function isStudySession(value: unknown): value is StudySession {
  const loc = 'types/index.ts#5742';
  const v = value as Partial<StudySession>;
  const ok =
    !!v &&
    typeof v === 'object' &&
    typeof v['id' as keyof typeof v] === 'string' &&
    typeof v['type' as keyof typeof v] === 'string' &&
    v['date' as keyof typeof v] instanceof Date;

  // Purposeful, low-frequency log (only when validation is called explicitly).
  // eslint-disable-next-line no-console
  console.log(`[${loc}] isStudySession check -> ${ok ? 'PASS' : 'FAIL'}`);
  return ok;
}

/**
 * @function isBlockSession
 * @description
 * Step 1) Narrows a StudySession to “block-like” categories used by the revision mirror rule.
 * Step 2) Performs a constant-time tag check to avoid branching complexity.
 * Step 3) Logs a single-line outcome with a unique code to aid field debugging when
 *         previous-day mirroring fails. Logging is intentionally concise and only
 *         occurs when this guard is invoked by schedulers.
 */
export function isBlockSession(
  session: { type?: string } | null | undefined
): session is { type: 'block' | 'revision-block' } {
  const loc = 'types/index.ts#6621';
  const ok =
    !!session &&
    (session.type === 'block' || session.type === 'revision-block');

  // eslint-disable-next-line no-console
  console.log(`[${loc}] isBlockSession check -> ${ok ? 'PASS' : 'FAIL'}`);
  return ok;
}
