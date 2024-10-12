import React from 'react';

interface PracticeSheetCardProps {
  id: string;
  title: string;
  quizType: 'matching' | 'multipleChoice' | 'wordProblem'; // Updated to accept quizType
  quizContent: string; // Updated to accept quizContent
  onOpenFullSize: () => void; // Callback to handle opening full-size view
  onDismiss?: () => void; // Optional callback to handle dismissal
}

const PracticeSheetCard: React.FC<PracticeSheetCardProps> = ({
  title,
  quizType,
  quizContent,
  onOpenFullSize,
  onDismiss,
}) => {
  // Extract a preview of the first question-answer pair for 'matching' type quizzes
  const preview =
    quizType === 'matching' ? quizContent.split(',')[0] : quizContent;

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
    <div className="bg-gray-200 p-4 border rounded shadow-sm cursor-pointer" onClick={onOpenFullSize}>
      <div className="flex justify-between items-center">
        <p className="font-bold text-lg">{title}</p>
        {onDismiss && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="text-gray-600 hover:text-gray-800"
            title="Dismiss"
          >
            ×
          </button>
        )}
      </div>
      <p className="text-gray-500 mt-2">
        <span className="font-semibold">{quizTypeLabel(quizType)}: </span>
        {preview ? preview : 'No content available'}
      </p>
    </div>
  );
};

export default PracticeSheetCard;
