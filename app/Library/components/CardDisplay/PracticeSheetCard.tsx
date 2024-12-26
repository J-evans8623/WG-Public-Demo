import React from 'react';
import QuizIcon from '@/app/icons-custom/Quiz.svg';
import '@/app/Library/components/CardDisplay/CardDisplaySlide.css'; // Import the CSS file

interface IQuizQuestion {
  id: string;
  type: 'matching' | 'multipleChoice' | 'wordProblem';
  question: string;
  correctAnswer: string;
}

interface PracticeSheetCardProps {
  id: string;
  title: string;
  quizType: 'matching' | 'multipleChoice' | 'wordProblem';
  quizQuestions: IQuizQuestion[];
  onOpenFullSize: () => void;
  onDismiss?: () => void;
}

const PracticeSheetCard: React.FC<PracticeSheetCardProps> = ({
  title,
  quizType,
  quizQuestions,
  onOpenFullSize,
  onDismiss,
}) => {
  // Generate a preview of the first question
  const preview =
    quizType === 'matching' && quizQuestions.length > 0
      ? `${quizQuestions[0].question} - ${quizQuestions[0].correctAnswer}`
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
    <div className="card card-practice" onClick={onOpenFullSize}>
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
