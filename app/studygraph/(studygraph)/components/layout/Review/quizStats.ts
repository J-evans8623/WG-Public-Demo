// File: app/studygraph/(studygraph)/utils/quizStats.ts

/**
 * @file quizStats.ts
 * @description
 *   Compute global quiz totals and accuracy from the raw per-question stats.
 *
 * @returns
 *   • totalAttempts: total number of question attempts
 *   • totalCorrect:  total correct answers
 *   • average:       overall accuracy percentage (0–100)
 */
import type { QuizItemStats } from '@/app/Library/Definitions/UserDataDefinitions';

export function computeQuizStats(
  statsMap: Record<string, QuizItemStats>
): { totalAttempts: number; totalCorrect: number; average: number } {
  const arr = Object.values(statsMap);
  const totalAttempts = arr.reduce((sum, s) => sum + s.totalAttempts, 0);
  const totalCorrect  = arr.reduce(
    (sum, s) => sum + (s.totalAttempts - s.incorrectAttempts),
    0
  );
  const average = totalAttempts > 0
    ? Math.round((totalCorrect / totalAttempts) * 100)
    : 0;

  return { totalAttempts, totalCorrect, average };
}
