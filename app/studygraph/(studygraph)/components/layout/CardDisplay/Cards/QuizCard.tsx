/**
 * @file QuizCard.tsx
 * @description
 *   Interactive quiz card body only (no title, no footer).
 *   Displays:
 *     • A “Quiz” badge
 *     • A “Start Quiz” button that opens the overlay
 *   Title is now rendered by ResourceDisplay’s fixed header;
 *   topic label by ResourceDisplay’s footer.
 */

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import QuizOverlay from '../../../utils/quiz/QuizOverlay';
import { IQuizQuestion, QuizType } from '@/app/Library/Definitions/Definitions';
import { mockQuizData } from '@/app/studygraph/(studygraph)/components/utils/quiz/mockQuizData';

// Default type fallback
const DEFAULT_QUIZ_TYPE: QuizType = 'matching';

export interface QuizCardProps {
  /** Card title (shown in ResourceDisplay header and passed to the overlay) */
  title: string;
  /** Quiz data and type */
  content?: {
    quizType: QuizType;
    quizContent: IQuizQuestion[];
  };
}

const QuizCard: React.FC<QuizCardProps> = ({ title, content }) => {
  const [isQuizOpen, setIsQuizOpen] = useState(false);

  // Determine quiz type & data
  const quizType = content?.quizType || DEFAULT_QUIZ_TYPE;
  const quizData = content?.quizContent || mockQuizData[quizType];

  return (
    <>
      <div className="py-6 flex flex-col items-center">
        {/* Badge */}
        <Badge
          variant="secondary"
          className="bg-orange-100 text-orange-700 border-orange-200"
        >
          Quiz
        </Badge>

        {/* Start button */}
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

      {/* Quiz Overlay */}
      <QuizOverlay
        isOpen={isQuizOpen}
        onClose={() => setIsQuizOpen(false)}
        quizType={quizType}
        title={title}
        quizData={quizData}
      />
    </>
  );
};

export default QuizCard;
