// QuizCard.tsx

/**
 * @file QuizCard.tsx
 * @description
 *   Interactive quiz card body only (no footer).
 *   - Displays type-specific badge & title by default.
 *   - “Start Quiz” button that opens the overlay.
 *   - New prop `hideHeader` to suppress badge + title.
 */

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import QuizOverlay from '../../../utils/quiz/QuizOverlay';
import { IQuizQuestion, QuizType } from '@/app/Library/Definitions/Definitions';

// Badge styles per quiz type
const QUIZ_TYPE_STYLES: Record<QuizType, { label: string; classes: string }> = {
  multipleChoice: { label: 'Multiple Choice',    classes: 'bg-blue-100 text-blue-700 border-blue-200' },
  'true-false':   { label: 'True / False',       classes: 'bg-red-100 text-red-700 border-red-200' },
  FIB:            { label: 'Fill in the Blank',  classes: 'bg-green-100 text-green-700 border-green-200' },
  matching:       { label: 'Matching',           classes: 'bg-purple-100 text-purple-700 border-purple-200' },
};

export interface QuizCardProps {
  /** Card title (shown above “Start Quiz”) */
  title: string;
  /** Data & type */
  content: {
    quizType: QuizType;
    quizContent: IQuizQuestion[];
  };
  /** When true, do NOT render badge + title */
  hideHeader?: boolean;
}

const QuizCard: React.FC<QuizCardProps> = ({
  title,
  content,
  hideHeader = false,
}) => {
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const { quizType, quizContent } = content;
  const { label, classes } = QUIZ_TYPE_STYLES[quizType] || {
    label: 'Quiz',
    classes: 'bg-gray-100 text-gray-700 border-gray-200',
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
          onClick={() => setIsQuizOpen(true)}
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
        quizData={quizContent}
      />
    </>
  );
};

export default QuizCard;
