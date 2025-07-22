/**
 * @file MatchingQuiz.tsx
 * @description
 *   Matching quiz component that presents questions on the left and an independently 
 *   shuffled answer bank on the right, preventing trivial matching by adjacency.
 *   Responsibilities:
 *   - Render a list of questions in the given order.
 *   - Independently shuffle the answer bank every session.
 *   - Track user selections and compute the score.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { IQuizQuestion } from '@/app/Library/Definitions/Definitions';
import QuizBase from './QuizBase';

/** Fisher–Yates shuffle helper */
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface MatchingQuizProps {
  quizData: IQuizQuestion[];
  onSubmit: (results: { id: string; correct: boolean }[]) => void;
  onClose: () => void;
}

const MatchingQuiz: React.FC<MatchingQuizProps> = ({
  quizData,
  onSubmit,
  onClose,
}) => {
  // User selections per question index (stores letter)
  const [matchingAnswers, setMatchingAnswers] = useState<string[]>([]);
  const [showScore, setShowScore] = useState(false);

  // Initialize empty answers when questions change
  useEffect(() => {
    setMatchingAnswers(Array(quizData.length).fill(''));
  }, [quizData]);

  // Build a separately shuffled answer bank from correct answers
  const answerBank = useMemo(() => {
    const allCorrect = quizData.map(q => q.correctAnswer as string);
    return shuffleArray(allCorrect);
  }, [quizData]);

  // Generate letter labels for the bank
  const letters = answerBank.map((_, i) => String.fromCharCode(65 + i));

  const handleAnswerChange = (questionIndex: number, letter: string) => {
    const next = [...matchingAnswers];
    next[questionIndex] = letter;
    setMatchingAnswers(next);
  };

// Replace your existing handleSubmit with this:
const handleSubmit = () => {
  const results = quizData.map((q, qi) => {
    const letter = matchingAnswers[qi];
    const idx    = letter.charCodeAt(0) - 65;
    return {
      id: q.id,
      correct: answerBank[idx] === q.correctAnswer,
    };
  });
  onSubmit(results);
};


  const isComplete = matchingAnswers.every(a => a !== '');

  const isLetterUsed = (letter: string) => matchingAnswers.includes(letter);

  const footerContent = (
    <div className="flex justify-end gap-4">
      <button
        onClick={onClose}
        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={handleSubmit}
        disabled={!isComplete}
        className={`px-4 py-2 rounded-md transition-colors ${
          isComplete
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        Submit
      </button>
    </div>
  );

  return (
    <QuizBase
      title="Matching Quiz"
      onClose={onClose}
      showScore={showScore}
      footerContent={footerContent}
    >
      <div className="grid grid-cols-[3fr,2fr] gap-8 p-6 h-full">
        {/* Questions */}
        <div className="overflow-y-auto pr-4 max-h-full">
          <div className="space-y-6">
            {quizData.map((q, qi) => (
              <div key={q.id} className="bg-gray-50 p-4 rounded-lg shadow-sm">
                <div className="text-sm text-gray-600 mb-2">
                  Question {qi + 1}
                </div>
                <div className="text-gray-900 mb-4">{q.question}</div>
                <select
                  className="w-full p-2 border rounded-md bg-white hover:border-blue-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                  value={matchingAnswers[qi] || ''}
                  onChange={e => handleAnswerChange(qi, e.target.value)}
                >
                  <option value="">Select an answer</option>
                  {letters.map(letter => (
                    <option key={letter} value={letter} disabled={isLetterUsed(letter)}>
                      Option {letter}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Answer Bank */}
        <div className="overflow-y-auto max-h-full">
          <div className="bg-gray-50 p-4 rounded-lg shadow-sm h-full">
            <h3 className="font-semibold text-lg mb-4 text-gray-900 sticky top-0 bg-gray-50 pt-1 pb-2">
              Answer Bank
            </h3>
            <div className="space-y-3">
              {answerBank.map((ans, i) => (
                <div
                  key={i}
                  className={`p-3 bg-white rounded-lg border border-gray-200 shadow-sm transition-all ${
                    isLetterUsed(letters[i])
                      ? 'line-through text-gray-400'
                      : 'text-gray-800'
                  }`}
                >
                  <span className={`font-medium mr-2 ${
                      isLetterUsed(letters[i])
                        ? 'text-gray-400'
                        : 'text-blue-600'
                    }`}>
                    {letters[i]}.
                  </span>
                  {ans}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </QuizBase>
  );
};

export default MatchingQuiz;
