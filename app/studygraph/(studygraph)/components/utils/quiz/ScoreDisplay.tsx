// File: src/app/studygraph/(studygraph)/components/utils/quiz/ScoreDisplay.tsx

/**
 * @file ScoreDisplay.tsx
 * @description
 *   Professional score display component that presents comprehensive quiz results with clean academic styling
 *   following the established brand theme. This component is responsible for rendering the final results screen 
 *   after quiz completion, showing users their performance across all questions with specific feedback on correct 
 *   and incorrect answers using a refined visual hierarchy. The component implements educational best practices by 
 *   providing immediate feedback, encouraging messages based on performance levels, and detailed answer comparisons 
 *   to support long-term knowledge retention. Key responsibilities include displaying aggregate scoring metrics with 
 *   professional typography, rendering individual question results with subtle visual indicators, providing contextual 
 *   feedback messages using the brand color palette, and offering navigation options for continued learning. The 
 *   enhanced design supports different quiz types through flexible result formatting while maintaining consistent 
 *   visual hierarchy and professional academic styling. The component integrates seamlessly with the portal-based 
 *   quiz architecture using the consolidated QuizStyles.css for consistent presentation. The design eliminates 
 *   redundant summary sections and focuses on educational value through clear question-by-question analysis with 
 *   restrained use of colors and professional spacing to maintain focus on learning outcomes.
 *
 * @responsibilities
 *   - Display comprehensive quiz results with overall score and percentage calculations using professional typography.
 *   - Render detailed question-by-question analysis with correct answer comparisons using brand color palette.
 *   - Provide performance-based encouragement messages and learning guidance with academic tone.
 *   - Implement visual feedback through subtle color coding and iconography for immediate recognition.
 *   - Support navigation options for retrying quiz or returning to study materials positioned at bottom.
 *   - Ensure accessibility compliance and responsive design using consolidated CSS classes.
 *   - Maintain educational effectiveness through clean result presentation and actionable feedback.
 *   - Eliminate redundant visual elements and focus on essential learning information.
 */

import React from 'react';
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
  isAssessment?:boolean
}

const ScoreDisplay: React.FC<ScoreDisplayProps> = ({ 
  score, 
  total, 
  onExit, 
  results = [], 
  onTryAgain,
  isAssessment
}) => {
  console.log('[ScoreDisplay.tsx:4001] Rendering score display with results:', results.length, 'items');

  // 1. Calculate performance metrics for user feedback
  const percentage = (score / total) * 100;

  /**
   * getPerformanceMessage - Generates contextual feedback based on quiz performance with academic tone
   * 
   * This function analyzes the user's quiz performance and returns appropriate encouragement
   * messages that provide educational guidance while maintaining a professional academic tone.
   * The function uses performance thresholds to categorize results and provide tailored
   * feedback that motivates continued learning while acknowledging current achievement levels.
   * Messages are designed to be constructive and focused on learning outcomes rather than emotional responses.
   * 
   * @returns Object containing performance message for display with academic tone
   */
  const getPerformanceMessage = () => {
    let messg:string;
    if (percentage >= 90) messg= "Outstanding work! You've mastered this topic.";
    if (percentage >= 80) messg ="Strong performance. You have a solid understanding.";
    if (percentage >= 70) messg = "Good progress. Review the concepts below for improvement.";
    if (percentage >= 60) messg = "Still room for improvement, Focus on the areas covered below.";
    else messg = "Still room for improvement, Focus on the areas below."
    messg = isAssessment ? "Your score has been submitted" : messg
    return messg ;
  };

  const performanceMessage = getPerformanceMessage();

  return (
    <div className="quiz-score-container" data-testid="ScoreDisplay">
      {/* Professional Score Header */}
      <div className="quiz-score-header">
        <div className="quiz-score-main">{score}/{total}</div>
        <div className="quiz-score-percentage">{percentage.toFixed(0)}% Correct</div>
        <div className="quiz-score-message">{performanceMessage}</div>
      </div>

      {/* Detailed Results Section */}
      {results.length > 0 && (
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