/**
 * @file NotificationUtils.ts
 * @responsibility
 *  A tiny, pure utility module for forum notification math. It exposes functions
 *  to compute unseen deltas and "dirty" flags without touching React, contexts,
 *  or persistence. Keep this file dependency-free to make unit tests trivial.
 */

 /**
  * @function computeUnseen
  * @purpose
  *  Return the non-negative difference between the current item count of a post
  *  (post itself counts as 1) and how many items the user has already seen.
  *
  *  Steps:
  *   1) Subtract seen from current.
  *   2) Clamp at zero to avoid negative deltas when records lag behind deletes.
  */
export function computeUnseen(currentCount: number, seenCount: number): number {
  // Step 1: raw delta
  const delta = currentCount - seenCount;
  // Step 2: clamp at 0
  return delta > 0 ? delta : 0;
}

/**
 * @function isDirty
 * @purpose
 *  Tell if a thread has any unseen items.
 *  Steps:
 *   1) A thread is "dirty" if unseen > 0.
 */
export function isDirty(unseen: number): boolean {
  return unseen > 0;
}

/**
 * @function coerceInitialSeen
 * @purpose
 *  Helper to ensure the first seen value is at least 1 (the post itself).
 *  Steps:
 *   1) If seenCount is falsy/zero, return 1; otherwise return seenCount.
 */
export function coerceInitialSeen(seenCount: number): number {
  return seenCount > 0 ? seenCount : 1;
}
