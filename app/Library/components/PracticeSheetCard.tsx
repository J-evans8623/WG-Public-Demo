import React from 'react';
import QuizIcon from '@/app/icons-custom/Quiz.svg';
import { parseQuizContent } from '@/app/Library/utils/QuizUtils'; // Import parseQuizContent

interface PracticeSheetCardProps {
  id: string;
  title: string;
  quizType: 'matching' | 'multipleChoice' | 'wordProblem';
  quizContent: string;
  onOpenFullSize: () => void;
  onDismiss?: () => void;
}

const PracticeSheetCard: React.FC<PracticeSheetCardProps> = ({
  title,
  quizType,
  quizContent,
  onOpenFullSize,
  onDismiss,
}) => {
  // Parse quiz content to extract a preview
  const parsedQuiz = parseQuizContent(quizContent);
  const preview =
    quizType === 'matching' && parsedQuiz.length > 0
      ? `${parsedQuiz[0].question}@${parsedQuiz[0].answer}`
      : 'No content available';

  // Define descriptions for each quiz type
  const quizTypeLabel = (type: 'matching' | 'multipleChoice' | 'wordProblem') => {
    switch (type) {
      case 'matching':
        return 'Matching Quiz';
      case 'multipleChoice':
        return 'Multiple Choice Quiz';
      case 'wordProblem':
        return 'Word Problem';
      default:
        return 'Unknown Quiz Type';
    }
  };

  return (
    <div
      className="bg-gray-200 p-4 border rounded shadow-sm cursor-pointer relative min-w-[150px] h-60 flex flex-col"
      onClick={onOpenFullSize}
    >
      {/* Dismiss Button */}
      {onDismiss && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="absolute top-2 right-2 text-gray-600 hover:text-gray-800"
          title="Dismiss"
        >
          ×
        </button>
      )}

      {/* Title at the top */}
      <div className="text-lg font-bold text-center mb-2">{title}</div>

      {/* Center the icon */}
      <div className="flex-grow flex items-center justify-center">
        <QuizIcon className="w-12 h-12" /> {/* Scaled down icon */}
      </div>

      {/* Quiz Type and Preview at the bottom */}
      <p className="text-gray-500 mt-2 text-center">
        <span className="font-semibold">{quizTypeLabel(quizType)}: </span>
        {preview}
      </p>
    </div>
  );
};

export default PracticeSheetCard;
