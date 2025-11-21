// app/studygraph/(studygraph)/components/utils/quiz/TrueFalseQuiz.tsx

/**
 * @file TrueFalseQuiz.tsx
 * @description
 * Standardized True/False Quiz component refactored for the unified portal architecture.
 * This component presents binary choice questions using the consistent "Pro" design language.
 * * The refactor eliminates the `QuizBase` wrapper and implements a robust flex/scroll
 * layout structure. This ensures the footer remains fixed at the bottom of the modal ("sticky")
 * while the question content scrolls independently, resolving previous layout bugs where
 * the footer was incorrectly positioned in the document flow.
 * * @responsibilities
 * - Render T/F questions using standardized styling.
 * - Maintain local selection state and support progress snapshotting.
 * - Convert boolean selections into human-readable strings for detailed result reporting.
 * - Provide a fixed layout with independent scrolling and a sticky footer.
 */

import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { IQuizQuestion, ITrueFalseQuestion } from '@/app/Library/Definitions/Definitions';
import { CheckCircle } from 'lucide-react';
// update - 1: Import unified styles
import '@/app/studygraph/(studygraph)/components/utils/quiz/QuizStyles.css';
import { type ProgressHandle, type ProgressSnapshot } from './scoringUtils';

interface TrueFalseQuizProps {
  quizData: IQuizQuestion[];
  // update - 2: Update signature to support detailed results
  onSubmit: (results: { id: string; correct: boolean }[], detailed?: any[]) => void;
  onClose: () => void;
}

const TrueFalseQuiz = forwardRef<ProgressHandle, TrueFalseQuizProps>(function TrueFalseQuiz(
  { quizData, onSubmit, onClose },
  ref
) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, boolean | null>>({});

  useImperativeHandle(ref, () => ({
    getProgress: (): ProgressSnapshot<Record<string, boolean | null>> => {
      console.log('[TrueFalseQuiz.tsx:5201] getProgress invoked', { answered: Object.keys(selectedAnswers).length });
      return { answers: selectedAnswers };
    },
  }), [selectedAnswers]);

  const handleAnswerSelect = (questionId: string, answer: boolean) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = () => {
    const detailedResults: any[] = [];
    const simpleResults = quizData.map((q) => {
      const tfq = q as ITrueFalseQuestion;
      const userVal = selectedAnswers[q.id];
      const isCorrect = userVal === tfq.correctAnswer;
      
      const userDisplay = userVal === true ? 'True' : userVal === false ? 'False' : '(No Answer)';
      const correctDisplay = tfq.correctAnswer ? 'True' : 'False';

      // update - 3: Construct detailed result payload
      detailedResults.push({
        id: q.id,
        question: q.question,
        selectedAnswer: userDisplay,
        correctAnswer: correctDisplay,
        correct: isCorrect
      });

      return {
        id: q.id,
        correct: isCorrect,
      };
    });

    console.log('[TrueFalseQuiz.tsx:5202] Submitting results', { count: simpleResults.length });
    onSubmit(simpleResults, detailedResults);
  };

  const answeredCount = Object.keys(selectedAnswers).length;
  const allQuestionsAnswered = quizData.every(q => selectedAnswers[q.id] !== undefined && selectedAnswers[q.id] !== null);

  return (
    // update - 4: Layout Wrapper with fixed height to manage scroll context
    <div style={{ height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      
      {/* Scrollable Content Area */}
      <div 
        className="quiz-scrollbar" 
        style={{ flex: 1, overflowY: 'auto', width: '100%' }}
      >
        <div className="quiz-questions-container" style={{ paddingBottom: '120px' }}>
          {quizData.map((question, index) => {
            return (
              <div key={question.id} className="quiz-question-item">
                <div className="quiz-question-number">
                  Question {index + 1}
                </div>
                <div className="quiz-question-text">{question.question}</div>
                
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  {[true, false].map((optionVal) => {
                    const isSelected = selectedAnswers[question.id] === optionVal;
                    const label = optionVal ? 'True' : 'False';
                    
                    return (
                      <div
                        key={label}
                        onClick={() => handleAnswerSelect(question.id, optionVal)}
                        className={`quiz-answer-option ${isSelected ? 'selected' : ''}`}
                        style={{ 
                          cursor: 'pointer', 
                          flex: 1, 
                          textAlign: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        <span className="quiz-answer-option-text" style={{ fontWeight: isSelected ? 600 : 400 }}>
                          {label}
                        </span>
                        {isSelected && <CheckCircle size={16} color="var(--quiz-success)" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* update - 5: Sticky Footer */}
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

export default TrueFalseQuiz;