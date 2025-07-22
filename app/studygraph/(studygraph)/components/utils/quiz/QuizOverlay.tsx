// QuizOverlay.tsx
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { IQuizQuestion, QuizType } from '@/app/Library/Definitions/Definitions';
import ScoreDisplay from './ScoreDisplay';
import MultipleChoiceQuiz from './MultipleChoiceQuiz';
import TrueFalseQuiz from './TrueFalseQuiz';
import FillInBlankQuiz from './FillInBlankQuiz';
import MatchingQuiz from './MatchingQuiz';
import { useUserData } from '@/app/Library/Context/UserDataContext';

interface QuizOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  quizType: QuizType;
  title: string;
  quizData: IQuizQuestion[];
}

const QuizOverlay: React.FC<QuizOverlayProps> = ({ isOpen, onClose, quizType, title, quizData }) => {
   const { recordQuizAttempt, recordQuizSession } = useUserData();
  const [showScore, setShowScore] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  // Reset score and visibility when overlay is closed
  useEffect(() => {
    if (!isOpen) {
      setShowScore(false);
      setScore({ correct: 0, total: 0 });
    }
  }, [isOpen]);

const handleScoreSubmit = (
  results: { id: string; correct: boolean }[]
) => {
  // 1) record each attempt
  results.forEach(r =>
    recordQuizAttempt(r.id, quizType, r.correct)
  );
  // 2) record one quiz session
  recordQuizSession();


  // 2) compute aggregate score
  const correctCount = results.filter(r => r.correct).length;
  setScore({ correct: correctCount, total: results.length });
  setShowScore(true);
};

  const handleExit = () => {
    setShowScore(false);
    setScore({ correct: 0, total: 0 });
    onClose();
  };

  const renderQuizContent = () => {
    if (showScore) {
      return <ScoreDisplay score={score.correct} total={score.total} onExit={handleExit} />;
    }

    if (!quizData || quizData.length === 0) return <div>No quiz questions available</div>;

    // Render quiz component based on quiz type
    switch (quizType) {
      case 'multipleChoice':
        return (
          <MultipleChoiceQuiz
            quizData={quizData}
            onSubmit={handleScoreSubmit}
            onClose={onClose}
          />
        );
      case 'true-false':
        return (
          <TrueFalseQuiz
            quizData={quizData}
            onSubmit={handleScoreSubmit}
            onClose={onClose}
          />
        );
      case 'FIB':
        return (
          <FillInBlankQuiz
            quizData={quizData}
            onSubmit={handleScoreSubmit}
            onClose={onClose}
          />
        );
      case 'matching':
        return (
          <MatchingQuiz
            quizData={quizData}
            onSubmit={handleScoreSubmit}
            onClose={onClose}
          />
        );
      default:
        return <div>Unsupported quiz type</div>;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={showScore ? undefined : onClose}
      />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] bg-white rounded-lg shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="text-xl font-semibold">{title}</h2>
          {!showScore && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {renderQuizContent()}
        </div>
      </div>
    </div>
  );
};

export default QuizOverlay;
