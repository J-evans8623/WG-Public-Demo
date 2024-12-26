// bloom-maps\app\Library\utils\QuizUtils.ts

import { IQuizQuestion } from "../Definitions/Definitions";

  // Utility function to scramble the answers
// Updated utility function to scramble the answers while keeping question-answer pairs randomized
export function scrambleAnswers(
  quiz: IQuizQuestion[]
): { question: string; scrambledAnswer: string }[] {
  const shuffledQuiz = [...quiz];

  // Fisher-Yates shuffle algorithm to shuffle question-answer pairs
  for (let i = shuffledQuiz.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledQuiz[i], shuffledQuiz[j]] = [shuffledQuiz[j], shuffledQuiz[i]];
  }

  return shuffledQuiz.map((q, i) => ({
    question: quiz[i].question, // Keep questions in the original order
    scrambledAnswer: shuffledQuiz[i].correctAnswer, // Use shuffled answers
  }));
}

  
  // Utility function to calculate the score by comparing user answers with the correct answers
  export function calculateScore(userAnswers: string[], answerKey: { question: string; answer: string }[]): number {
    let score = 0;
  
    userAnswers.forEach((userAnswer, index) => {
      if (userAnswer === answerKey[index].answer) {
        score++;
      }
    });
  
    return score;
  }
  
  // Utility function to scramble an array
  export function scrambleArray<T>(array: T[]): T[] {
    const scrambled = [...array];
    for (let i = scrambled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [scrambled[i], scrambled[j]] = [scrambled[j], scrambled[i]];
    }
    return scrambled;
  }
  