// File: src/app/workspace/(studygraph)/components/utils/quizUtils.ts

/**
 * @file quizUtils.ts
 * @description
 *   Utilities for quiz data manipulation.
 *   - shuffleAndLimit: randomizes an array and returns up to a maximum number of items.
 *
 * @responsibilities
 *   - Provide deterministic side-effect-free list sampling.
 */

export function shuffleAndLimit<T>(items: T[], max: number): T[] {
  console.log('[quizUtils.ts:0001] shuffleAndLimit called with length:', items.length);
  const array = items.slice();
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  const result = array.slice(0, max);
  console.log('[quizUtils.ts:0002] shuffleAndLimit returning length:', result.length);
  return result;
}
