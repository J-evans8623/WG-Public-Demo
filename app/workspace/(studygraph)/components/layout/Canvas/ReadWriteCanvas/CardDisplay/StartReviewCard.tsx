/**
 * @file bloom-maps/app/workspace/(studygraph)/components/layout/Canvas/ReadWriteCanvas/CardDisplay/StartReviewCard.tsx
 * @description
 * This file implements the **fully branded StartReviewCard component**, refactored to serve as a high-fidelity 
 * sentinel UI block for lesson-wide assessment. To ensure total brand alignment, this component now utilizes 
 * the `BaseResourceCard` wrapper and adheres to the "Slide" design pattern, featuring standardized 
 * header, body, and footer sections. It mimics the visual structure of a `QuizCard` while acting 
 * as a functional shortcut that does not require underlying Y.Doc resource data. By consuming 
 * the `useLaunchUnitReview` hook, it provides a consistent interactive entry point for assessment 
 * sessions. This implementation restores visual harmony to the right-rail resource panel, 
 * treating the sentinel review trigger as a first-class citizen of the studygraph UI while 
 * maintaining the performance benefits of an $O(1)$ Interceptor Pattern.
 */

import React from 'react';
import { useLaunchUnitReview } from '@/app/workspace/(studygraph)/components/hooks/useLaunchUnitReview';
import BaseResourceCard from '@/app/workspace/(studygraph)/components/layout/CardDisplay/v2/BaseResourceCard';

/**
 * StartReviewCard
 * Responsibility: Renders a unit review shortcut that is visually identical to standard resource cards. 
 * It ensures the user's primary "Unit Mastery" trigger is presented within the branded card frame.
 * Function Complexity: O(1) rendering with standard slide architecture.
 */
const StartReviewCard: React.FC = () => {
  const { launchReview } = useLaunchUnitReview();

  return (
    <BaseResourceCard 
      className="resource-display preview-slide fixed-height" 
      tabIndex={0}
    >
      <div className="preview-slide-header">
        <div className="preview-slide-title">Unit Mastery Review</div>
        <div className="preview-slide-actions" />
      </div>

      <div className="preview-slide-body">
        <div className="preview-slide-content" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          textAlign: 'center',
        }}>
          <div className="quiz-info-section">
            <h4 className="quiz-info-title">Test your knowledge</h4>
            <p className="quiz-info-description">
              Review all flashcards and quizzes from this entire lesson to reinforce your learning.
            </p>
          </div>

          {/* No inline style override — let the JSX class handle the gradient */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              launchReview();
            }} 
            className="quiz-start-button"
          >
            Start Review
          </button>
        </div>
      </div>

      <div className="preview-slide-footer">
        <span className="concept-node-label">Assessment</span>
        <span className="slide-number" />
      </div>

      <style jsx>{`
        .quiz-info-title {
          font-size: 1.125rem;
          font-weight: 500;
          color: #111827;
          margin-bottom: 0.75rem;
        }
        .quiz-info-description {
          color: #6b7280;
          font-size: 0.9rem;
          line-height: 1.6;
          margin: 0;
        }
        .quiz-start-button {
  display: inline-block;
  background: linear-gradient(135deg, #5B8C5A 0%, #4a7349 100%);
  color: white;
  padding: 14px 32px;        /* exact px values from computed styles */
  border-radius: 8px;
  font-weight: 500;
  font-size: 16px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: rgba(0,0,0,0.1) 0px 4px 6px -1px, rgba(0,0,0,0.06) 0px 2px 4px -1px;
  width: 160px;              /* ← hardcoded, no more width:100% / max-width fighting */
  text-align: center;
}
        .quiz-start-button:hover {
          background: linear-gradient(135deg, #6b9c6a 0%, #5a8359 100%);
          transform: translateY(-1px);
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
        }
        .quiz-start-button:active {
          transform: translateY(0);
        }
      `}</style>
    </BaseResourceCard>
  );
};

export default StartReviewCard;