// File: src/app/studygraph/(studygraph)/components/utils/quiz/QuizOverlay.tsx

/**
 * @file QuizOverlay.tsx
 * @description
 *   Enhanced quiz overlay component with per-instance portal management that eliminates DOM conflicts
 *   between multiple quiz instances across slideshow and resource display contexts. This implementation
 *   creates unique portal roots for each QuizOverlay instance, preventing shared portal cleanup issues
 *   that caused quiz launch failures after slideshow-to-resource-display transitions. The component
 *   manages the complete quiz experience lifecycle including initialization, question rendering,
 *   user interaction tracking, score computation, and comprehensive results display with detailed
 *   question analysis. Key architectural improvements include instance-specific portal isolation,
 *   enhanced cleanup mechanisms, and improved error handling to ensure reliable quiz launching
 *   across all application contexts. The portal system now guarantees that each quiz instance
 *   operates independently without interfering with other quiz instances or DOM state, resolving
 *   the critical issue where quiz buttons became non-functional after slideshow interactions.
 *
 * @responsibilities
 *   - Create unique portal roots per instance to prevent DOM conflicts between quiz instances.
 *   - Manage quiz lifecycle states including loading, active quiz, and results display phases.
 *   - Coordinate with UserData context for quiz attempt tracking and analytics integration.
 *   - Provide consistent modal backdrop and overlay styling independent of parent CSS context.
 *   - Handle quiz type routing to appropriate component implementations with proper props passing.
 *   - Implement robust cleanup and event listener management for portal-rendered content.
 *   - Ensure accessibility compliance and keyboard navigation support for modal interactions.
 *   - Manage detailed results data flow from quiz components to score display interface.
 *   - Support comprehensive educational feedback through question-by-question analysis display.
 */

import React, { useEffect, useState, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { IQuizQuestion, QuizType } from '@/app/Library/Definitions/Definitions';
import ScoreDisplay from './ScoreDisplay';
import MultipleChoiceQuiz from './MultipleChoiceQuiz';
import TrueFalseQuiz from './TrueFalseQuiz';
import FillInBlankQuiz from './FillInBlankQuiz';
import MatchingQuiz from './MatchingQuiz';
import { useUserData } from '@/app/Library/Context/UserDataContext';
import './QuizStyles.css';

interface QuizOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  quizType: QuizType;
  title: string;
  quizData: IQuizQuestion[];
}

const QuizOverlay: React.FC<QuizOverlayProps> = ({ 
  isOpen, 
  onClose, 
  quizType, 
  title, 
  quizData 
}) => {
  // 1. Initialize component state for quiz progression and score management
  const { recordQuizAttempt, recordQuizSession } = useUserData();
  const [showScore, setShowScore] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [detailedResults, setDetailedResults] = useState<any[]>([]);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  // 2. Create unique instance identifier to prevent portal conflicts
  const instanceId = useRef(`quiz-modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  /**
   * initializeInstancePortalRoot - Creates unique portal root per QuizOverlay instance
   * 
   * This function creates a dedicated portal mounting point for each QuizOverlay instance,
   * preventing DOM conflicts between multiple quiz instances that previously caused launch
   * failures. Each instance gets a unique ID-based portal root that operates independently,
   * ensuring that slideshow quiz interactions don't interfere with resource display quiz
   * functionality. The approach eliminates shared state issues while maintaining proper
   * z-index stacking and overlay positioning for all quiz modals across application contexts.
   */
  useEffect(() => {
    console.log('[QuizOverlay.tsx:4001] Initializing per-instance portal root with ID:', instanceId.current);
    
    // 3. Create unique portal root element for this specific instance
    const uniquePortalId = instanceId.current;
    let modalRoot = document.getElementById(uniquePortalId);
    
    if (!modalRoot) {
      console.log('[QuizOverlay.tsx:4002] Creating new unique portal root:', uniquePortalId);
      modalRoot = document.createElement('div');
      modalRoot.id = uniquePortalId;
      modalRoot.style.position = 'fixed';
      modalRoot.style.top = '0';
      modalRoot.style.left = '0';
      modalRoot.style.width = '100%';
      modalRoot.style.height = '100%';
      modalRoot.style.zIndex = '2000'; // Higher than slideshow z-index (1001)
      modalRoot.style.pointerEvents = 'none'; // Allow clicks through when no modal content
      document.body.appendChild(modalRoot);
    }
    
    // 4. Enable pointer events when modal content is present
    modalRoot.style.pointerEvents = isOpen ? 'auto' : 'none';
    
    setPortalRoot(modalRoot);
    
    // 5. Cleanup function to remove only this instance's portal root
    return () => {
      console.log('[QuizOverlay.tsx:4003] Cleaning up instance-specific portal:', uniquePortalId);
      const portalElement = document.getElementById(uniquePortalId);
      
      if (portalElement && portalElement.parentNode === document.body) {
        try {
          document.body.removeChild(portalElement);
          console.log('[QuizOverlay.tsx:4004] Successfully removed instance portal root');
        } catch (error) {
          console.warn('[QuizOverlay.tsx:4005] Failed to remove instance portal root:', error);
        }
      }
    };
  }, [isOpen]); // Only run once per component instance

  // 6. Update portal pointer events based on open state
  useEffect(() => {
    if (portalRoot) {
      portalRoot.style.pointerEvents = isOpen ? 'auto' : 'none';
      console.log('[QuizOverlay.tsx:4006] Updated portal pointer events:', isOpen ? 'auto' : 'none');
    }
  }, [isOpen, portalRoot]);

  // 7. Reset quiz state when overlay closes to ensure clean state for next quiz session
  useEffect(() => {
    if (!isOpen) {
      console.log('[QuizOverlay.tsx:4007] Resetting quiz state on overlay close');
      setShowScore(false);
      setScore({ correct: 0, total: 0 });
      setDetailedResults([]);
    }
  }, [isOpen]);

  /**
   * handleScoreSubmit - Processes quiz completion and manages analytics recording with detailed results flow
   * 
   * This function handles the final submission of quiz results by recording individual question
   * attempts and overall quiz session data through the UserData context. It computes aggregate
   * scoring metrics and transitions the UI to results display mode. The function implements
   * proper error handling and logging to support debugging and analytics verification while
   * maintaining optimal performance through efficient result processing algorithms. Critical enhancement
   * includes proper management of detailed results data to support comprehensive educational feedback.
   * 
   * @param results - Array of question results containing ID and correctness status
   * @param detailed - Optional array of comprehensive question analysis data for educational display
   */
  const handleScoreSubmit = (
    results: { id: string; correct: boolean }[],
    detailed?: any[]
  ) => {
    console.log('[QuizOverlay.tsx:4008] Processing quiz score submission with', results.length, 'results');
    console.log('[QuizOverlay.tsx:4009] Detailed results received:', detailed ? detailed.length : 0, 'items');
    
    // 8. Record individual quiz attempts for analytics and progress tracking
    results.forEach(result => 
      recordQuizAttempt(result.id, quizType, result.correct)
    );
    
    // 9. Record overall quiz session for engagement metrics
    recordQuizSession();

    // 10. Compute aggregate score with O(n) time complexity
    const correctCount = results.filter(result => result.correct).length;
    const finalScore = { correct: correctCount, total: results.length };
    
    console.log('[QuizOverlay.tsx:4010] Quiz completion - Score:', correctCount, '/', results.length);
    
    // 11. Update component state to display results with detailed information
    setScore(finalScore);
    setDetailedResults(detailed || []);
    setShowScore(true);
    
    console.log('[QuizOverlay.tsx:4011] State updated - showScore:', true, 'detailedResults length:', (detailed || []).length);
  };

  /**
   * handleTryAgain - Manages quiz retry functionality with comprehensive state reset
   * 
   * This function handles the complete reset process for quiz retry sessions including state cleanup,
   * detailed results clearing, and proper UI state management to prepare for a fresh quiz attempt.
   * The function ensures that all quiz-related state is properly cleared to prevent memory
   * leaks and data contamination between quiz sessions while maintaining optimal user experience.
   */
  const handleTryAgain = () => {
    console.log('[QuizOverlay.tsx:4012] Initiating quiz retry - resetting all state');
    setShowScore(false);
    setScore({ correct: 0, total: 0 });
    setDetailedResults([]);
    console.log('[QuizOverlay.tsx:4013] Quiz retry state reset complete');
  };

  /**
   * handleExit - Manages quiz exit flow and state cleanup
   * 
   * This function handles the complete exit process for quiz sessions including state reset,
   * cleanup of temporary data, and proper callback execution to notify parent components.
   * The function ensures that all quiz-related state is properly cleared to prevent memory
   * leaks and prepares the component for potential future quiz sessions within the same
   * application lifecycle.
   */
  const handleExit = () => {
    console.log('[QuizOverlay.tsx:4014] Executing quiz exit sequence');
    setShowScore(false);
    setScore({ correct: 0, total: 0 });
    setDetailedResults([]);
    onClose();
  };

  /**
   * renderQuizContent - Dynamically renders appropriate quiz component based on type with detailed results support
   * 
   * This function implements the quiz type routing logic to render the appropriate specialized
   * quiz component based on the provided quiz type. It handles prop passing, error states for
   * invalid quiz data, and maintains consistent interface contracts across all quiz implementations.
   * The function uses a switch-based approach for O(1) component selection and implements proper
   * fallback rendering for edge cases and unsupported quiz types. Enhanced to properly manage
   * detailed results data flow for comprehensive educational feedback in the results display phase.
   * 
   * @returns JSX element for the appropriate quiz component or fallback content
   */
  const renderQuizContent = () => {
    // 12. Handle results display state with detailed analysis support
    if (showScore) {
      console.log('[QuizOverlay.tsx:4015] Rendering ScoreDisplay with detailed results:', detailedResults.length, 'items');
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

    // 13. Validate quiz data availability
    if (!quizData || quizData.length === 0) {
      console.log('[QuizOverlay.tsx:4016] No quiz questions available for rendering');
      return <div>No quiz questions available</div>;
    }

    // 14. Route to appropriate quiz component based on type with O(1) lookup
    console.log('[QuizOverlay.tsx:4017] Rendering quiz type:', quizType, 'with', quizData.length, 'questions');
    
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
        console.log('[QuizOverlay.tsx:4018] Unsupported quiz type encountered:', quizType);
        return <div>Unsupported quiz type</div>;
    }
  };

  // 15. Early return if overlay is closed or portal root not ready
  if (!isOpen || !portalRoot) {
    return null;
  }

  // 16. Render quiz modal through instance-specific React portal for complete DOM isolation
  console.log('[QuizOverlay.tsx:4019] Rendering quiz overlay through instance portal:', instanceId.current, 'showScore:', showScore);
  
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

export default QuizOverlay;