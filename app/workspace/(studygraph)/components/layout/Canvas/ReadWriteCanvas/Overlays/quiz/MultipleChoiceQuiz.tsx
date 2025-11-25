// app/workspace/(studygraph)/components/utils/quiz/MultipleChoiceQuiz.tsx

/**
 * @file MultipleChoiceQuiz.tsx
 * @description
 * Standardized Multiple Choice Quiz component refactored to align with the "Pro" styling system
 * and portal-based architecture. This component renders a vertical list of questions with
 * selectable options, utilizing the unified `QuizStyles.css` for consistent typography,
 * spacing, and interactive states. It eliminates the legacy `QuizBase` wrapper to resolve
 * nested modal visual bugs.
 * * Functionally, it implements the `ProgressHandle` interface for the parent overlay to support
 * early-exit scoring and enhances the submission logic to generate a detailed results payload.
 * * Layout Update: This component now manages its own scrolling context via a full-height wrapper.
 * This ensures the absolute positioned footer remains "sticky" at the bottom of the modal
 * regardless of content length.
 * * @responsibilities
 * - Render MCQ items using standardized CSS classes directly into the overlay context.
 * - Manage local selection state and expose progress via `useImperativeHandle`.
 * - Compute pass/fail status per question and construct detailed result objects for review.
 * - Provide a fixed/sticky footer at the bottom of the view.
 */

import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { IQuizQuestion, IMultipleChoiceQuestion } from '@/app/Library/Definitions/Definitions';
import { CheckCircle } from 'lucide-react'; 
// update - 1: Ensure we use the shared styles
import '@/app/workspace/(studygraph)/components/utils/quiz/QuizStyles.css';
import { type ProgressHandle, type ProgressSnapshot } from './scoringUtils';

interface MultipleChoiceQuizProps {
  quizData: IQuizQuestion[];
  // update - 2: Update signature to accept detailed results for the score display
  onSubmit: (results: { id: string; correct: boolean }[], detailed?: any[]) => void;
  onClose: () => void;
}

const MultipleChoiceQuiz = forwardRef<ProgressHandle, MultipleChoiceQuizProps>(function MultipleChoiceQuiz(
  { quizData, onSubmit, onClose },
  ref
) {
  // 1. Local state for user selections
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  // 2. Expose progress for parent Overlay's early-exit logic
  useImperativeHandle(ref, () => ({
    getProgress: (): ProgressSnapshot<Record<string, string>> => {
      console.log('[MultipleChoiceQuiz.tsx:5101] getProgress invoked', { answered: Object.keys(selectedOptions).length });
      return { answers: selectedOptions };
    },
  }), [selectedOptions]);

  const handleOptionSelect = (questionId: string, option: string) => {
    setSelectedOptions((prev) => ({ ...prev, [questionId]: option }));
  };

  const handleSubmit = () => {
    const detailedResults: any[] = [];
    const simpleResults = quizData.map((q) => {
      const mcq = q as IMultipleChoiceQuestion;
      const userAns = selectedOptions[q.id] || '';
      const isCorrect = userAns === mcq.correctAnswer;

      // update - 3: Construct detailed result object
      detailedResults.push({
        id: q.id,
        question: q.question,
        selectedAnswer: userAns || '(No Answer)',
        correctAnswer: mcq.correctAnswer,
        correct: isCorrect
      });

      return {
        id: q.id,
        correct: isCorrect,
      };
    });

    console.log('[MultipleChoiceQuiz.tsx:5102] Submitting results', { count: simpleResults.length });
    onSubmit(simpleResults, detailedResults);
  };

  const answeredCount = Object.keys(selectedOptions).length;
  const allQuestionsAnswered = answeredCount === quizData.length;

  return (
    // update - 4: Layout Wrapper
    // We create a relative, 100% height container to stop the parent `quiz-content` from scrolling.
    // The footer will be absolutely positioned relative to THIS container.
    <div style={{ height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      
      {/* Scrollable Content Area
          This inner div handles the overflow, ensuring the scrollbar is on the full-width edge.
          We use `flex: 1` to fill available space above the footer.
      */}
      <div 
        className="quiz-scrollbar" 
        style={{ flex: 1, overflowY: 'auto', width: '100%' }}
      >
        <div className="quiz-questions-container" style={{ paddingBottom: '120px' }}>
          {quizData.map((question, index) => {
            const mcq = question as IMultipleChoiceQuestion;
            return (
              <div key={question.id} className="quiz-question-item">
                <div className="quiz-question-number">
                  Question {index + 1}
                </div>
                <div className="quiz-question-text">{question.question}</div>
                
                <div className="space-y-3">
                  {mcq.options.map((option) => {
                    const isSelected = selectedOptions[question.id] === option;
                    return (
                      <div
                        key={option}
                        onClick={() => handleOptionSelect(question.id, option)}
                        className={`quiz-answer-option ${isSelected ? 'selected' : ''}`}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div 
                            style={{
                              height: '20px', 
                              width: '20px', 
                              borderRadius: '50%', 
                              border: isSelected ? '5px solid var(--quiz-accent-green)' : '2px solid var(--quiz-border-tan)',
                              marginRight: '12px',
                              backgroundColor: 'white',
                              flexShrink: 0
                            }} 
                          />
                          <span className="quiz-answer-option-text">{option}</span>
                        </div>
                        
                        {isSelected && (
                          <div style={{ color: 'var(--quiz-success)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem' }}>
                            <CheckCircle size={16} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* update - 5: Sticky Footer
          Placed outside the scroll container, pinned to the bottom of the wrapper.
      */}
      <div className="quiz-footer">
        <div className="quiz-progress-text">
          {answeredCount} of {quizData.length} questions answered
        </div>
        <div className="quiz-footer-actions">
          <button
            onClick={onClose}
            className="quiz-btn quiz-btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!allQuestionsAnswered}
            className="quiz-btn quiz-btn-primary"
          >
            Submit Quiz
          </button>
        </div>
      </div>
    </div>
  );
});

export default MultipleChoiceQuiz;