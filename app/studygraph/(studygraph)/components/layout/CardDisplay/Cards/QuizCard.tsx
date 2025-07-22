// File: src/app/studygraph/(studygraph)/components/layout/CardDisplay/Cards/QuizCard.tsx

/**
 * @file QuizCard.tsx
 * @description
 *   Interactive quiz card body only (no footer).
 *   - Displays type-specific badge & title by default.
 *   - “Start Quiz” button that opens the overlay.
 *   - Limits quiz questions to a random sample of up to 10 per session.
 *   - Logs sampling for observability.
 *
 * @responsibilities
 *   - Sample quizContent via shuffleAndLimit.
 *   - Maintain selectedQuestions state.
 *   - Pass sampled questions into QuizOverlay.
 */

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import QuizOverlay from '../../../utils/quiz/QuizOverlay';
import { IQuizQuestion, QuizType } from '@/app/Library/Definitions/Definitions';
import { shuffleAndLimit } from './quizUtils';

// Badge styles per quiz type
const QUIZ_TYPE_STYLES: Record<QuizType, { label: string; classes: string }> = {
  multipleChoice: { label: 'Multiple Choice', classes: 'bg-blue-100 text-blue-700 border-blue-200' },
  'true-false':   { label: 'True / False',    classes: 'bg-red-100 text-red-700 border-red-200' },
  FIB:            { label: 'Fill in the Blank', classes: 'bg-green-100 text-green-700 border-green-200' },
  matching:       { label: 'Matching',         classes: 'bg-purple-100 text-purple-700 border-purple-200' },
};

export interface QuizCardProps {
  /** Card title (displayed above “Start Quiz”) */
  title: string;
  /** Quiz data & type */
  content: {
    quizType: QuizType;
    quizContent: IQuizQuestion[];
  };
  parentQuizId: string;
  mapId: string
  /** When true, suppress badge + title */
  hideHeader?: boolean;
}

const QuizCard: React.FC<QuizCardProps> = ({ title, content, hideHeader = false , mapId,parentQuizId}) => {
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState<IQuizQuestion[]>([]);
  const { quizType, quizContent } = content;
  const { label, classes } = QUIZ_TYPE_STYLES[quizType] || {
    label: 'Quiz', classes: 'bg-gray-100 text-gray-700 border-gray-200'
  };

  const handleStartQuiz = () => {
    console.log('[QuizCard.tsx:1001] handleStartQuiz total questions:', quizContent.length);
    const sample = shuffleAndLimit(quizContent, 10).map(q => ({
    ...q,
    parentQuizId: parentQuizId,   // sheet is the PracticeSheetResource
    mapId:        mapId
  }));
setSelectedQuestions(sample);
    setIsQuizOpen(true);
  };

  return (
    <>
      <div className="py-6 flex flex-col items-center">
        {!hideHeader && (
          <>
            <Badge
              variant="secondary"
              className={`border ${classes} px-2 py-1 rounded-full text-sm font-medium`}
            >
              {label}
            </Badge>
            <h3 className="mt-3 text-lg font-semibold text-gray-800 text-center">
              {title}
            </h3>
          </>
        )}
        <button
          onClick={handleStartQuiz}
          className="
            mt-6
            bg-gray-50 hover:bg-gray-100
            px-4 py-2 rounded-lg
            transition-colors
            font-medium text-gray-700
          "
        >
          Start Quiz
        </button>
      </div>

      <QuizOverlay
        isOpen={isQuizOpen}
        onClose={() => setIsQuizOpen(false)}
        quizType={quizType}
        title={title}
        quizData={selectedQuestions}
      />
    </>
  );
};

export default QuizCard;
