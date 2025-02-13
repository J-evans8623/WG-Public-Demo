// QuizCard.tsx

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import QuizOverlay from '../../../utils/quiz/QuizOverlay';
import { IQuizQuestion, QuizType } from '@/app/Library/Definitions/Definitions';
import { mockQuizData } from '@/app/studygraph/(studygraph)/components/utils/quiz/mockQuizData';

// CHANGE THIS LINE TO TEST DIFFERENT QUIZ TYPES
/**
 * 
 * For Multiple Choice Quiz: 'multipleChoice'
For True/False Quiz: 'true-false'
For Fill in the Blank Quiz: 'FIB'
For Matching Quiz: 'matching'
 * 
 */
const DEFAULT_QUIZ_TYPE: QuizType = 'matching';

export interface QuizCardProps {
  topicTitle: string;
  title: string;
  content?: {
    quizType: QuizType;
    quizContent: IQuizQuestion[];
  };
}

const QuizCard: React.FC<QuizCardProps> = ({ topicTitle, title, content }) => {
  const [isQuizOpen, setIsQuizOpen] = useState(false);

  // Use the mock data based on quiz type or fall back to default
  const quizType = content?.quizType || DEFAULT_QUIZ_TYPE;
  const quizData = content?.quizContent || mockQuizData[quizType];

  return (
    <>
      <div className="py-[1.125rem]">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
              Quiz
            </Badge>
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              {topicTitle}
            </span>
          </div>
          <div className="mt-1 h-px bg-gray-200 ml-[calc(4rem_+_0.5625rem)]" />
        </div>

        <h3 className="font-medium text-xl mt-6 text-gray-900 leading-relaxed text-center">
          {title}
        </h3>

        <div 
          className="mt-6 flex items-center justify-center bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          onClick={() => setIsQuizOpen(true)}
        >
          <span className="font-medium text-gray-700">Click to start quiz</span>
        </div>
      </div>

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