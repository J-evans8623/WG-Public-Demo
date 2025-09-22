/**  @\app\studygraph\(studygraph)\components\layout\Canvas\ReadWriteCanvas\Overlays\quiz\scoringUtils.ts
 * @file scoringUtils.ts
 * @description
 *   Pure, deterministic scoring utilities for all quiz types (Multiple Choice, True/False,
 *   Fill-in-the-Blank, and Matching). This module is the single source of truth for computing
 *   grades, enforcing a consistent policy that (1) unanswered questions count as incorrect and
 *   (2) the denominator is always the total number of questions. It exports both per-type
 *   scorers and a typed dispatcher `scoreByType` to keep calling sites simple and uniform.
 *   The functions are side-effect free and TypeScript-typed for safety. They return both
 *   simplified per-question correctness (for fast aggregation) and detailed results suitable
 *   for review UIs. The design emphasizes O(N) passes, minimal allocations, and testability.
 *   Console logging is limited to scoring entry/exit with outcome summaries for observability.
 *
 *   Responsibilities:
 *   1) Define shared types: ProgressSnapshot, DetailedResult, ScoreResult.
 *   2) Provide per-type scorers with uniform unanswered handling.
 *   3) Offer a single dispatcher to route by QuizType.
 *   4) Optimize for O(N) complexity; avoid DOM and React dependencies entirely.
 */

import {
  IQuizQuestion,
  IMultipleChoiceQuestion,
  ITrueFalseQuestion,
  IFillInBlankQuestion,
  QuizType,
} from '@/app/Library/Definitions/Definitions';

/** ------------------------------------------------------------------------------------------------
 * Shared Types
 * ------------------------------------------------------------------------------------------------*/

/**
 * ProgressSnapshot
 * @purpose
 *   Captures the minimal, serializable state needed to score a quiz attempt without reaching into
 *   component internals. `answers` holds the user’s current selections in a type-appropriate shape
 *   (e.g., record map for MCQ/TF, arrays for FIB/Matching). `evalContext` optionally carries
 *   extra data required to evaluate the answers deterministically (e.g., Matching’s shuffled
 *   `answerBank`). This structure decouples UI from scoring policy and allows early-exit scoring.
 */
export type ProgressSnapshot<TCtx = unknown> = {
  answers: unknown;
  evalContext?: TCtx;
};

/**
 * DetailedResult
 * @purpose
 *   Provides per-question analysis used in post-quiz review UIs and for grade submissions.
 *   It records the question text, the user’s resolved answer (normalized where relevant),
 *   the authoritative correct answer, and a boolean correctness flag. This shape mirrors
 *   the payloads already consumed by our ScoreDisplay and gradebook pipeline.
 */
export type DetailedResult = {
  id: string;
  question: string;
  selectedAnswer: string;
  correctAnswer: string;
  correct: boolean;
};

/**
 * ScoreResult
 * @purpose
 *   Encapsulates the scoring outcome with aggregate counts (correct/total), a compact
 *   correctness array for fast consumption, and rich `detailed` results for review.
 *   The result is fully deterministic for a given snapshot and quiz dataset.
 */
export type ScoreResult = {
  correct: number;
  total: number;
  simple: { id: string; correct: boolean }[];
  detailed: DetailedResult[];
};

/** ------------------------------------------------------------------------------------------------
 * Internal Helpers
 * ------------------------------------------------------------------------------------------------*/

/**
 * normalizeForCompare
 * @purpose
 *   Normalizes free-text answers for case-insensitive, whitespace-trimmed comparisons.
 *   This yields robust matching for Fill-in-the-Blank scenarios while remaining
 *   deterministic and locale-safe for simple English content.
 */
function normalizeForCompare(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .trim();
}

/**
 * buildScoreResult
 * @purpose
 *   Builds the final ScoreResult in O(N) by folding detailed rows into aggregate counts
 *   and a compact `{id, correct}` map. This keeps collector logic in one place.
 */
function buildScoreResult(detailed: DetailedResult[]): ScoreResult {
  let correct = 0;
  const simple = new Array<{ id: string; correct: boolean }>(detailed.length);
  for (let i = 0; i < detailed.length; i++) {
    const row = detailed[i];
    if (row.correct) correct++;
    simple[i] = { id: row.id, correct: row.correct };
  }
  return {
    correct,
    total: detailed.length,
    simple,
    detailed,
  };
}

/** ------------------------------------------------------------------------------------------------
 * Per-Type Scorers
 * ------------------------------------------------------------------------------------------------*/

/**
 * scoreMultipleChoice
 * @purpose
 *   Scores Multiple Choice questions by strict equality of selected option to the
 *   authoritative correctAnswer. Unanswered or unknown options are incorrect.
 *   Time: O(N) with a single pass over quizData; space: O(N) for results only.
 */
export function scoreMultipleChoice(
  quizData: IQuizQuestion[],
  snapshot: ProgressSnapshot<Record<string, string | undefined>>
): ScoreResult {
  console.log('[scoringUtils.ts][5710] MCQ scoring begin', {
    qLen: quizData.length,
  });

  const answers = snapshot?.answers || {};
  const detailed: DetailedResult[] = quizData.map((q) => {
    const mcq = q as IMultipleChoiceQuestion;
    const selected = (answers as Record<string, string | undefined>)[q.id];
    const selectedAnswer = selected ?? '';
    const correctAnswer = mcq.correctAnswer ?? '';

    const correct = selectedAnswer === correctAnswer;
    return {
      id: q.id,
      question: q.question,
      selectedAnswer,
      correctAnswer,
      correct,
    };
  });

  const result = buildScoreResult(detailed);
  console.log('[scoringUtils.ts][5711] MCQ scoring end', {
    correct: result.correct,
    total: result.total,
  });
  return result;
}

/**
 * scoreTrueFalse
 * @purpose
 *   Scores True/False by strict boolean equality. `null`/`undefined` are considered unanswered
 *   and result in incorrect. Time: O(N); space: O(N) for results only.
 */
export function scoreTrueFalse(
  quizData: IQuizQuestion[],
  snapshot: ProgressSnapshot<Record<string, boolean | null | undefined>>
): ScoreResult {
  console.log('[scoringUtils.ts][5720] TF scoring begin', {
    qLen: quizData.length,
  });

  const answers = snapshot?.answers || {};
  const detailed: DetailedResult[] = quizData.map((q) => {
    const tf = q as ITrueFalseQuestion;
    const selected = (answers as Record<string, boolean | null | undefined>)[q.id];

    const selectedAnswer =
      selected === true ? 'True' : selected === false ? 'False' : '';
    const correctAnswer = tf.correctAnswer === true ? 'True' : 'False';
    const correct = typeof selected === 'boolean' && selectedAnswer === correctAnswer;

    return {
      id: q.id,
      question: q.question,
      selectedAnswer,
      correctAnswer,
      correct,
    };
  });

  const result = buildScoreResult(detailed);
  console.log('[scoringUtils.ts][5721] TF scoring end', {
    correct: result.correct,
    total: result.total,
  });
  return result;
}

/**
 * scoreFIB
 * @purpose
 *   Scores Fill-in-the-Blank by case-insensitive, trimmed string comparison between
 *   the learner’s answer and the correctAnswer. Empty/blank yields incorrect.
 *   Time: O(N); space: O(N) for results only.
 */
export function scoreFIB(
  quizData: IQuizQuestion[],
  snapshot: ProgressSnapshot<string[]>
): ScoreResult {
  console.log('[scoringUtils.ts][5730] FIB scoring begin', {
    qLen: quizData.length,
  });

  const answers = (snapshot?.answers as string[]) || [];
  const detailed: DetailedResult[] = quizData.map((q, idx) => {
    const fib = q as IFillInBlankQuestion;
    const selectedRaw = answers[idx] ?? '';
    const selectedAnswer = selectedRaw;
    const correctAnswer = String(fib.correctAnswer ?? '');

    const correct =
      normalizeForCompare(selectedRaw) === normalizeForCompare(fib.correctAnswer);

    return {
      id: q.id,
      question: fib.questionText || q.question,
      selectedAnswer,
      correctAnswer,
      correct,
    };
  });

  const result = buildScoreResult(detailed);
  console.log('[scoringUtils.ts][5731] FIB scoring end', {
    correct: result.correct,
    total: result.total,
  });
  return result;
}

/**
 * scoreMatching
 * @purpose
 *   Scores Matching by mapping a per-question **letter** selection (A, B, C, …) to the
 *   shuffled `answerBank` from the snapshot.evalContext. The resolved answer is compared
 *   against each question’s `correctAnswer`. Blank/missing letters are incorrect.
 *   Time: O(N); space: O(N) for results only.
 */
export function scoreMatching(
  quizData: IQuizQuestion[],
  snapshot: ProgressSnapshot<{ answerBank: string[] }>
): ScoreResult {
  console.log('[scoringUtils.ts][5740] Matching scoring begin', {
    qLen: quizData.length,
  });

  const letters = (snapshot?.answers as string[]) || [];
  const ctx = snapshot?.evalContext as { answerBank: string[] } | undefined;
  const bank = ctx?.answerBank || [];

  const detailed: DetailedResult[] = quizData.map((q, qi) => {
    const letter = letters[qi] || '';
    const idx = letter ? letter.charCodeAt(0) - 65 : -1; // A => 0
    const selectedFromBank =
      idx >= 0 && idx < bank.length ? bank[idx] : '';

    const correctAnswer = String(q.correctAnswer ?? '');
    const selectedAnswer = selectedFromBank;

    const correct = selectedAnswer !== '' && selectedAnswer === correctAnswer;

    return {
      id: q.id,
      question: q.question,
      selectedAnswer,
      correctAnswer,
      correct,
    };
  });

  const result = buildScoreResult(detailed);
  console.log('[scoringUtils.ts][5741] Matching scoring end', {
    correct: result.correct,
    total: result.total,
  });
  return result;
}

/** ------------------------------------------------------------------------------------------------
 * Dispatcher
 * ------------------------------------------------------------------------------------------------*/

/**
 * scoreByType
 * @purpose
 *   Single entry-point for scoring a quiz, routing to the correct per-type scorer. It validates
 *   the minimal context required for evaluation (e.g., Matching’s `answerBank`) and applies the
 *   unified “unanswered is incorrect” policy. This function is the one the Overlay will call in
 *   Phase 2 for both full submissions and early-exit grading.
 */
export function scoreByType(
  quizType: QuizType,
  quizData: IQuizQuestion[],
  snapshot: ProgressSnapshot<any>
): ScoreResult {
  console.log('[scoringUtils.ts][5750] scoreByType enter', {
    quizType,
    qLen: quizData.length,
  });

  let result: ScoreResult;
  switch (quizType) {
    case 'multipleChoice':
      result = scoreMultipleChoice(quizData, snapshot);
      break;
    case 'true-false':
      result = scoreTrueFalse(quizData, snapshot);
      break;
    case 'FIB':
      result = scoreFIB(quizData, snapshot);
      break;
    case 'matching': {
      const hasBank = !!snapshot?.evalContext?.answerBank?.length;
      if (!hasBank) {
        console.warn('[scoringUtils.ts][5751] Matching scoring missing answerBank in evalContext');
      }
      result = scoreMatching(quizData, snapshot);
      break;
    }
    default:
      // Defensive fallback: unknown type → everything incorrect with empty selections
      const detailed: DetailedResult[] = quizData.map((q) => ({
        id: q.id,
        question: q.question,
        selectedAnswer: '',
        correctAnswer: String(q.correctAnswer ?? ''),
        correct: false,
      }));
      result = buildScoreResult(detailed);
      console.warn('[scoringUtils.ts][5752] Unsupported quizType encountered; returning all incorrect', {
        quizType,
      });
  }

  console.log('[scoringUtils.ts][5753] scoreByType exit', {
    correct: result.correct,
    total: result.total,
  });
  return result;
}

/** ------------------------------------------------------------------------------------------------
 * Optional Surface (Phase 2 Aid)
 * ------------------------------------------------------------------------------------------------*/

/**
 * ProgressHandle
 * @purpose
 *   A tiny imperative surface that child quiz components can expose (via forwardRef) so that
 *   callers (e.g., QuizOverlay) can snapshot progress at any time. Implemented in Phase 2.
 */
export type ProgressHandle = {
  getProgress: () => ProgressSnapshot<any>;
};
