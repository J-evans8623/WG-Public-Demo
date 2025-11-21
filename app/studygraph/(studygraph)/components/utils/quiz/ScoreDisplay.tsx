// File: src/app/studygraph/(studygraph)/components/utils/quiz/ScoreDisplay.tsx

/**
 * @file ScoreDisplay.tsx
 * @description
 * Professional score display component that presents comprehensive quiz results with clean academic styling
 * following the established brand theme. This component is responsible for rendering the final results screen
 * after quiz completion.
 * * UX Update: Added an auto-scroll effect on mount. Since this component replaces the quiz content
 * in-place within a scrollable modal, we must programmatically reset the scroll position to the top
 * (0,0) to ensure the user sees their score summary immediately, rather than retaining the scroll
 * position from the "Submit" button at the bottom of the previous view.
 *
 * @responsibilities
 * - Display comprehensive quiz results with overall score and percentage calculations.
 * - Render detailed question-by-question analysis with correct answer comparisons.
 * - Provide performance-based encouragement messages.
 * - Reset scroll position on mount to ensure top-of-page visibility.
 */

import React, { useEffect, useRef } from 'react';
import { CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import './QuizStyles.css';

interface QuizResult {
  id: string;
  question: string;
  selectedAnswer: string;
  correctAnswer: string;
  correct: boolean;
}

interface ScoreDisplayProps {
  score: number;
  total: number;
  onExit: () => void;
  results?: QuizResult[];
  onTryAgain?: () => void;
  isAssessment?: boolean;
}

const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  score,
  total,
  onExit,
  results = [],
  onTryAgain,
  isAssessment
}) => {
  // update - 1: Ref for the container to target scrolling
  const containerRef = useRef<HTMLDivElement>(null);

  console.log('[ScoreDisplay.tsx:4001] Rendering score display with results:', results.length, 'items');

  // 1. Calculate performance metrics for user feedback
  const percentage = (score / total) * 100;

  // update - 2: Auto-scroll to top on mount
  // The component often mounts into a container that is already scrolled to the bottom (from the Submit button).
  // We need to reset this to ensure the score header is visible.
  useEffect(() => {
    // Attempt to scroll the immediate container if it exists
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
    
    // Also target the common scrollable parent class used in QuizOverlay
    const scrollableContent = document.querySelector('.quiz-content');
    if (scrollableContent) {
      scrollableContent.scrollTop = 0;
    }
    
    // Fallback: scroll window (for mobile/different layout contexts)
    window.scrollTo(0, 0);
    
    console.log('[ScoreDisplay.tsx:4005] Scroll position reset to top');
  }, []);

  /**
   * getPerformanceMessage - Generates contextual feedback based on quiz performance with academic tone
   */
  const getPerformanceMessage = () => {
    let messg: string;
    if (percentage >= 90) messg = "Outstanding work! You've mastered this topic.";
    else if (percentage >= 80) messg = "Strong performance. You have a solid understanding.";
    else if (percentage >= 70) messg = "Good progress. Review the concepts below for improvement.";
    else if (percentage >= 60) messg = "Still room for improvement, Focus on the areas covered below.";
    else messg = "Still room for improvement, Focus on the areas below.";
    
    messg = isAssessment ? "Your score has been submitted" : messg;
    return messg;
  };

  const performanceMessage = getPerformanceMessage();

  return (
    // update - 3: Attach ref to top-level container
    <div ref={containerRef} className="quiz-score-container" data-testid="ScoreDisplay">
      {/* Professional Score Header */}
      <div className="quiz-score-header">
        <div className="quiz-score-main">{score}/{total}</div>
        <div className="quiz-score-percentage">{percentage.toFixed(0)}% Correct</div>
        <div className="quiz-score-message">{performanceMessage}</div>
      </div>

      {/* Detailed Results Section */}
      {results.length > 0 && !isAssessment && (
        <div className="quiz-results-section">
          <div className="quiz-results-list">
            {results.map((result, index) => (
              <div
                key={result.id}
                className={`quiz-result-card ${result.correct ? 'correct' : 'incorrect'}`}
              >
                <div className="quiz-result-header">
                  <div className={`quiz-result-icon ${result.correct ? 'correct' : 'incorrect'}`}>
                    {result.correct ? (
                      <CheckCircle size={20} />
                    ) : (
                      <XCircle size={20} />
                    )}
                  </div>
                  
                  <div className="quiz-result-meta">
                    <span className="quiz-result-question-number">
                      Question {index + 1}
                    </span>
                    <span className={`quiz-result-status ${result.correct ? 'correct' : 'incorrect'}`}>
                      {result.correct ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>
                </div>
                
                {/* Question Text */}
                <h4 className="quiz-result-question">{result.question}</h4>
                
                {/* Answer Comparison */}
                <div className="quiz-result-answers">
                  {/* User's Answer */}
                  <div className={`quiz-result-answer ${result.correct ? 'user-correct' : 'user-incorrect'}`}>
                    <div className="quiz-result-answer-label">
                      <span className="quiz-answer-indicator">●</span>
                      Your Answer:
                    </div>
                    <div className="quiz-result-answer-text">
                      {result.selectedAnswer}
                    </div>
                  </div>
                  
                  {/* Correct Answer (always show for learning) */}
                  <div className="quiz-result-answer correct-answer">
                    <div className="quiz-result-answer-label">
                      <span className="quiz-answer-indicator">●</span>
                      Correct Answer:
                    </div>
                    <div className="quiz-result-answer-text">
                      {result.correctAnswer}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Action Buttons at Bottom */}
      <div className="quiz-score-actions">
        {onTryAgain && !isAssessment && (
          <button
            onClick={() => {
              console.log('[ScoreDisplay.tsx:4002] Try again button clicked');
              onTryAgain();
            }}
            className="quiz-btn quiz-btn-blue"
          >
            <RotateCcw size={16} style={{ marginRight: '0.5rem' }} />
            Try Again
          </button>
        )}
        <button
          onClick={() => {
            console.log('[ScoreDisplay.tsx:4003] Back to study button clicked');
            onExit();
          }}
          className="quiz-btn quiz-btn-primary"
        >
          Back to Study
        </button>
      </div>
    </div>
  );
};

export default ScoreDisplay;