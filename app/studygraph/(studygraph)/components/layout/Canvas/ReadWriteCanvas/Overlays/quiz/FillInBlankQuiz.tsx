// app/studygraph/(studygraph)/components/utils/quiz/FillInBlankQuiz.tsx

/**
 * @file FillInBlankQuiz.tsx
 * @description
 * Standardized Fill-in-the-Blank Quiz component refactored to align with the portal-based
 * architecture and "Pro" styling system. This component utilizes the shared `quiz-two-column-layout`
 * to present questions on the left and a sticky "Concept Bank" on the right, mirroring the
 * UX of the Matching Quiz.
 * * The refactor removes the legacy `QuizBase` wrapper, implements standardized CSS classes
 * for dropdowns and bank items, and significantly enhances the submission logic to report
 * detailed, text-based results for the `ScoreDisplay` review.
 * * @responsibilities
 * - Render a two-column layout (Questions vs. Bank) directly into the overlay context.
 * - Manage local state for dropdown selections and visually track used bank items.
 * - Expose progress via `useImperativeHandle` for early-exit scoring.
 * - Compute and pass granular `detailedResults` to the parent handler for educational feedback.
 */

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { IQuizQuestion, IFillInBlankQuestion } from '@/app/Library/Definitions/Definitions';
import { CheckCircle } from 'lucide-react';
// update - 1: Import unified styles
import '@/app/studygraph/(studygraph)/components/utils/quiz/QuizStyles.css';
import { type ProgressHandle, type ProgressSnapshot } from './scoringUtils';

interface FillInBlankQuizProps {
  quizData: IQuizQuestion[];
  // update - 2: Update signature to support detailed results
  onSubmit: (results: { id: string; correct: boolean }[], detailed?: any[]) => void;
  onClose: () => void;
}

const FillInBlankQuiz = forwardRef<ProgressHandle, FillInBlankQuizProps>(function FillInBlankQuiz(
  { quizData, onSubmit, onClose },
  ref
) {
  const [answers, setAnswers] = useState<string[]>([]);
  // Store all possible answers for the Concept Bank
  const [allAnswers, setAllAnswers] = useState<string[]>([]);

  useEffect(() => {
    setAnswers(Array(quizData.length).fill(''));
    // Extract correct answers for the bank
    setAllAnswers(quizData.map(q => (q as IFillInBlankQuestion).correctAnswer as string));
  }, [quizData]);

  // update - 3: Expose progress for parent Overlay's early-exit logic
  useImperativeHandle(ref, () => ({
    getProgress: (): ProgressSnapshot<string[]> => {
      console.log('[FillInBlankQuiz.tsx:5301] getProgress invoked', { answered: answers.filter(Boolean).length });
      return { answers };
    },
  }), [answers]);

  const handleAnswerSelect = (questionIndex: number, value: string) => {
    setAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[questionIndex] = value === 'blank' ? '' : value;
      return newAnswers;
    });
  };

  /**
   * handleSubmit
   * Computes correctness and generates detailed result objects.
   * Standardizes the comparison logic (trim/lowercase) and constructs the payload
   * required by ScoreDisplay to show "Your Answer" vs "Correct Answer".
   */
  const handleSubmit = () => {
    const detailedResults: any[] = [];
    
    const results = quizData.map((q, i) => {
      const fibQ = q as IFillInBlankQuestion;
      const userAns = answers[i] || '';
      const correctAns = fibQ.correctAnswer.toString();
      
      const isCorrect = userAns.trim().toLowerCase() === correctAns.trim().toLowerCase();

      // update - 4: Push detailed result
      detailedResults.push({
        id: q.id,
        question: fibQ.questionText, // Specific property for FIB questions
        selectedAnswer: userAns || '(No Answer)',
        correctAnswer: correctAns,
        correct: isCorrect
      });

      return {
        id: q.id,
        correct: isCorrect,
      };
    });

    console.log('[FillInBlankQuiz.tsx:5302] Submitting results', { count: results.length });
    onSubmit(results, detailedResults);
  };

  // Helper to visually cross out items in the bank if they are currently selected
  const isAnswerSelected = (answer: string) => answers.includes(answer);

  const answeredCount = answers.filter(a => a !== '').length;
  const allQuestionsAnswered = answeredCount === quizData.length;

  return (
    /* update - 5: Root layout using standardized two-column class */
    <div className="quiz-two-column-layout">
      
      {/* Left Column: Questions */}
      <div className="quiz-questions-column quiz-scrollbar">
        {quizData.map((question, index) => (
          <div key={question.id} className="quiz-question-item">
            <div className="quiz-question-number">
              Question {index + 1}
            </div>
            <div className="quiz-question-text">
              {(question as IFillInBlankQuestion).questionText}
            </div>
            
            {/* Standardized Select Input */}
            <select
              value={answers[index] || 'blank'}
              onChange={(e) => handleAnswerSelect(index, e.target.value)}
              className="quiz-select"
            >
              <option value="blank">Select an answer...</option>
              {allAnswers.map((answer, idx) => (
                <option key={`${answer}-${idx}`} value={answer}>
                  {answer}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Right Column: Concept Bank */}
      <div className="quiz-answer-bank-column">
        <div className="quiz-answer-bank">
          <h3 className="quiz-answer-bank-title">Concept Bank</h3>
          <div className="quiz-answer-bank-scroll quiz-scrollbar">
            {allAnswers.map((answer, idx) => {
              const selected = isAnswerSelected(answer);
              return (
                <div 
                  key={`${answer}-${idx}`} 
                  className={`quiz-answer-option ${selected ? 'selected' : ''}`}
                >
                  <span className="quiz-answer-option-text">
                    {answer}
                  </span>
                  {selected && (
                    <div style={{ 
                      marginTop: '0.5rem', 
                      fontSize: '0.875rem', 
                      color: 'var(--quiz-success)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem' 
                    }}>
                      <CheckCircle size={16} />
                      <span>Used</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer: Sticky actions bar */}
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

export default FillInBlankQuiz;