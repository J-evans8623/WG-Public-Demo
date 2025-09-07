// ROQuizOverlay.tsx - Read-Only specific QuizOverlay

import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { IQuizQuestion, QuizType } from '@/app/Library/Definitions/Definitions';
import ScoreDisplay from '../../../utils/quiz/ScoreDisplay';
import MultipleChoiceQuiz from '../../../utils/quiz/MultipleChoiceQuiz';
import TrueFalseQuiz from '../../../utils/quiz/TrueFalseQuiz';
import FillInBlankQuiz from '../../../utils/quiz/FillInBlankQuiz';
import MatchingQuiz from '../../../utils/quiz/MatchingQuiz';
import { useUserData } from '@/app/Library/Context/UserDataContext';
import '../../../utils/quiz/QuizStyles.css';

interface QuizOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  quizType: QuizType;
  title: string;
  quizData: IQuizQuestion[];
}

const ROQuizOverlay: React.FC<QuizOverlayProps> = ({ 
  isOpen, 
  onClose, 
  quizType, 
  title, 
  quizData 
}) => {
  const { recordQuizAttempt, recordQuizSession } = useUserData();
  const [showScore, setShowScore] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [detailedResults, setDetailedResults] = useState<any[]>([]);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  // ✅ SOLUTION: Use read-only specific portal root ID
  const PORTAL_ROOT_ID = 'ro-quiz-modal-root'; // Different from main QuizOverlay

  useEffect(() => {
    console.log('[ROQuizOverlay.tsx:3001] Initializing RO-specific portal root');
    
    let modalRoot = document.getElementById(PORTAL_ROOT_ID);
    if (!modalRoot) {
      console.log('[ROQuizOverlay.tsx:3002] Creating new RO quiz portal root');
      modalRoot = document.createElement('div');
      modalRoot.id = PORTAL_ROOT_ID; // ✅ Context-specific ID
      modalRoot.style.position = 'relative';
      modalRoot.style.zIndex = '2000';
      document.body.appendChild(modalRoot);
    }
    
    setPortalRoot(modalRoot);
    
    return () => {
      console.log('[ROQuizOverlay.tsx:3003] Cleaning up RO quiz portal');
      if (modalRoot && modalRoot.children.length === 0) {
        if (modalRoot.parentNode === document.body) {
          try {
            document.body.removeChild(modalRoot);
            console.log('[ROQuizOverlay.tsx:3004] Successfully removed RO modal root');
          } catch (error) {
            console.warn('[ROQuizOverlay.tsx:3005] Failed to remove RO modal root:', error);
          }
        }
      }
    };
  }, []);

  // Reset state when overlay closes
  useEffect(() => {
    if (!isOpen) {
      setShowScore(false);
      setScore({ correct: 0, total: 0 });
      setDetailedResults([]);
    }
  }, [isOpen]);

  const handleScoreSubmit = (
    results: { id: string; correct: boolean }[],
    detailed?: any[]
  ) => {
    results.forEach(result => 
      recordQuizAttempt(result.id, quizType, result.correct)
    );
    recordQuizSession();

    const correctCount = results.filter(result => result.correct).length;
    const finalScore = { correct: correctCount, total: results.length };
    
    setScore(finalScore);
    setDetailedResults(detailed || []);
    setShowScore(true);
  };

  const handleTryAgain = () => {
    setShowScore(false);
    setScore({ correct: 0, total: 0 });
    setDetailedResults([]);
  };

  const handleExit = () => {
    setShowScore(false);
    setScore({ correct: 0, total: 0 });
    setDetailedResults([]);
    onClose();
  };

  const renderQuizContent = () => {
    if (showScore) {
      return (
        <ScoreDisplay 
          score={score.correct} 
          total={score.total} 
          onExit={handleExit}
          results={detailedResults}
          onTryAgain={handleTryAgain}
        />
      );
    }

    if (!quizData || quizData.length === 0) {
      return <div>No quiz questions available</div>;
    }
    
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
            title={title}
            quizData={quizData}
            onSubmit={handleScoreSubmit}
            onClose={onClose}
          />
        );
      default:
        return <div>Unsupported quiz type</div>;
    }
  };

  if (!isOpen || !portalRoot) {
    return null;
  }
  
  return ReactDOM.createPortal(
    <div className="quiz-overlay">
      <div className="quiz-modal">
        {!showScore && (
          <div className="quiz-header">
            <h2 className="quiz-title">{title}</h2>
            <button
              onClick={onClose}
              className="quiz-close-btn"
              aria-label="Close Quiz"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className="quiz-content" style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {renderQuizContent()}
        </div>
      </div>
    </div>,
    portalRoot
  );
};

export default ROQuizOverlay;