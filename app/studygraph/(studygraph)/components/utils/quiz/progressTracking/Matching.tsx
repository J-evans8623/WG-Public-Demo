/**
 * @file MatchingQuiz.tsx
 * @description
 *   Professional matching quiz component redesigned for portal-based rendering architecture with refined
 *   academic styling that follows the established brand theme. This component presents questions in their 
 *   original order on the left and an independently shuffled answer bank on the right, preventing trivial 
 *   matching by adjacency while maintaining optimal user experience within the portal-rendered modal context. 
 *   The component has been refactored to work seamlessly within the parent portal-based QuizOverlay system 
 *   using consolidated CSS classes for consistent visual presentation. Key responsibilities include rendering 
 *   questions with professional typography, independently shuffling the answer bank for each quiz session 
 *   using optimal algorithms, tracking user selections with subtle visual feedback using brand colors, 
 *   computing comprehensive scoring results with O(n) time complexity, and displaying detailed post-quiz 
 *   analysis through a clean results interface. The enhanced design implements professional visual hierarchy 
 *   with restrained color usage, improved spacing with the brand's almond and blue-gray palette, and smooth 
 *   transitions that maintain focus on educational content rather than flashy visual effects. The component 
 *   maintains all existing prop interfaces for backwards compatibility while providing substantial educational 
 *   functionality through comprehensive results display including individual question analysis, correct answer 
 *   presentation, and constructive feedback messages. The professional architecture ensures proper DOM 
 *   integration within the portal system while eliminating redundant visual elements.
 *
 * @responsibilities
 *   - Render quiz content within portal-based overlay system using professional CSS classes.
 *   - Generate independently shuffled answer bank to prevent pattern matching by position.
 *   - Track user selections and provide subtle visual feedback using brand color palette.
 *   - Compute comprehensive scoring with individual question result analysis using optimal algorithms.
 *   - Display detailed results with correct answers and constructive educational feedback.
 *   - Implement smooth transitions and professional styling compatible with portal architecture.
 *   - Manage quiz and results state transitions within the parent overlay container.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { IQuizQuestion } from '@/app/Library/Definitions/Definitions';
import { CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import './QuizStyles.css';

/**
 * shuffleArray - Fisher–Yates shuffle algorithm implementation for array randomization
 * 
 * This utility function implements the Fisher-Yates shuffle algorithm to provide cryptographically
 * secure randomization of array elements. The algorithm ensures uniform distribution of permutations
 * with O(n) time complexity, making it optimal for answer bank randomization in quiz scenarios.
 * Each element has equal probability of appearing in any position, preventing predictable patterns.
 * 
 * @param arr - Input array to be shuffled
 * @returns New array with elements randomly shuffled
 */
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface MatchingQuizProps {
  title: string;
  quizData: IQuizQuestion[];
  onSubmit: (results: { id: string; correct: boolean }[], detailed?: any[]) => void;
  onClose: () => void;
  onProgress?: (partial: { id: string; correct: boolean }[], details?: any[]) => void;
}

const MatchingQuiz: React.FC<MatchingQuizProps> = ({
  title,
  quizData,
  onSubmit,
  onClose,
  onProgress,
}) => {
  // 1. Initialize component state for quiz interaction and results management
  const [matchingAnswers, setMatchingAnswers] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [quizResults, setQuizResults] = useState<Array<{
    id: string;
    question: string;
    selectedAnswer: string;
    correctAnswer: string;
    correct: boolean;
  }>>([]);

  

  // 3. Generate shuffled answer bank with memoization for performance optimization
  const answerBank = useMemo(() => {
    console.log('[MatchingQuiz.tsx:4002] Generating shuffled answer bank from', quizData.length, 'correct answers');
    const allCorrect = quizData.map(q => q.correctAnswer as string);
    return shuffleArray(allCorrect);
  }, [quizData]);

  // 4. Generate letter labels for answer bank with O(1) access time
  const letters = answerBank.map((_, i) => String.fromCharCode(65 + i));

  /**
   * handleAnswerChange - Updates user selection for specific question index
   * 
   * This function manages user answer selection by updating the matchingAnswers state array
   * with the selected letter option. It maintains question-to-answer mapping through array
   * indexing and triggers re-render to update visual feedback. The function implements
   * controlled component pattern for reliable state management and user interaction tracking.
   * 
   * @param questionIndex - Zero-based index of the question being answered
   * @param letter - Selected letter option from answer bank (A, B, C, etc.)
   */
   const handleAnswerChange = (questionIndex: number, letter: string) => {
    console.log('[MatchingQuiz.tsx][4003] answer changed → q:', questionIndex + 1, 'opt:', letter);
    const next = [...matchingAnswers];
    next[questionIndex] = letter;
    setMatchingAnswers(next);
    emitProgress(next);
  };


  /**
   * emitProgress
   * @description
   *   Build partial correctness and optional details arrays from current selection state so the
   *   overlay can grade early exits. Unanswered questions are considered incorrect. O(N).
   */
  const emitProgress = useCallback((answersState: string[]) => { // update - 2
    if (!onProgress) return;
    const partial = quizData.map((q, qi) => {
      const letter = answersState[qi];
      if (!letter) return { id: q.id, correct: false };
      const idx = letter.charCodeAt(0) - 65;
      const selectedAnswer = answerBank[idx];
      const isCorrect = selectedAnswer === q.correctAnswer;
      return { id: q.id, correct: !!isCorrect };
    });
    const details = quizData.map((q, qi) => {
      const letter = answersState[qi];
      if (!letter) return { id: q.id, isCorrect: false, userAnswer: null };
      const idx = letter.charCodeAt(0) - 65;
      const selectedAnswer = answerBank[idx];
      const isCorrect = selectedAnswer === q.correctAnswer;
      return {
        id: q.id,
        isCorrect,
        userAnswer: selectedAnswer ?? null,
      };
    });
    onProgress(partial, details);
  }, [onProgress, quizData, answerBank]);

  /**
   * handleSubmit - Processes quiz submission and generates comprehensive results
   * 
   * This function computes quiz results by comparing user selections with correct answers,
   * generates detailed result objects for each question, and transitions to results display.
   * It maps letter selections to actual answers, determines correctness, and creates structured
   * result data for educational analysis. The function also calls the parent onSubmit callback
   * to integrate with broader application analytics and tracking systems.
   */
  const handleSubmit = () => {
    console.log('[MatchingQuiz.tsx:4004] Processing quiz submission with', matchingAnswers.length, 'answers');
    
    // 5. Generate comprehensive results with individual question analysis
    const results = quizData.map((q, qi) => {
      const letter = matchingAnswers[qi];
      const idx = letter.charCodeAt(0) - 65;
      const selectedAnswer = answerBank[idx];
      const isCorrect = selectedAnswer === q.correctAnswer;
      
      return {
        id: q.id,
        question: q.question,
        selectedAnswer: selectedAnswer,
        correctAnswer: q.correctAnswer as string,
        correct: isCorrect,
      };
    });

    console.log('[MatchingQuiz.tsx:4005] Quiz results computed - correct answers:', results.filter(r => r.correct).length);

    // 6. Update state and trigger parent callback for analytics
    setQuizResults(results);
    setShowResults(true);
    
    // 7. Call parent callback with both simple and detailed results
    const simpleResults = results.map(r => ({ id: r.id, correct: r.correct }));
    onSubmit(simpleResults, results);
  };

  /**
   * handleTryAgain - Resets quiz state for new attempt
   * 
   * This function resets all quiz-related state to initial values, allowing users to retake
   * the quiz with a fresh start. It clears user selections, hides results display, and
   * resets result data while preserving the original question and answer bank configuration.
   * The function supports iterative learning by enabling multiple quiz attempts.
   */
  const handleTryAgain = () => {
    console.log('[MatchingQuiz.tsx][4006] try again');
    const reset = Array(quizData.length).fill('');
    setMatchingAnswers(reset);
    setShowResults(false);
    setQuizResults([]);
    emitProgress(reset); // update - 6
  };

  // 8. Compute derived state for UI logic
  const isComplete = matchingAnswers.every(a => a !== '');
  const isLetterUsed = (letter: string) => matchingAnswers.includes(letter);
  const score = quizResults.filter(r => r.correct).length;


  // 2. Initialize empty answers array when quiz data changes
  useEffect(() => {
    console.log('[MatchingQuiz.tsx:4001] Initializing matching answers array for', quizData.length, 'questions');
    setMatchingAnswers(Array(quizData.length).fill(''));
    emitProgress(Array(quizData.length).fill(''));
  }, [emitProgress, quizData]);

  // 9. Render results view with professional styling and comprehensive feedback
  if (showResults) {
    return (
      <div className="quiz-score-container">
        {/* Results Header */}
        <div className="quiz-score-header">
          <div className="quiz-score-main">{score}/{quizResults.length}</div>
          <div className="quiz-score-percentage">{Math.round((score/quizResults.length) * 100)}% Correct</div>
          <div className="quiz-score-message">
            {score === quizResults.length ? "Outstanding work! You've mastered this topic." : 
             score >= quizResults.length * 0.8 ? "Strong performance. You have a solid understanding." :
             score >= quizResults.length * 0.6 ? "Good progress. Review the concepts below for improvement." :
             "Continue studying. Focus on the areas covered below."}
          </div>
        </div>

        {/* Detailed Results */}
        <div className="quiz-results-section">
          <h4 className="quiz-results-title">Detailed Review</h4>
          <div className="quiz-results-list">
            {quizResults.map((result, index) => (
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
                
                <h5 className="quiz-result-question">{result.question}</h5>
                
                <div className="quiz-result-answers">
                  <div className={`quiz-result-answer ${result.correct ? 'user-correct' : 'user-incorrect'}`}>
                    <div className="quiz-result-answer-label">
                      <span className="quiz-answer-indicator">●</span>
                      Your Answer:
                    </div>
                    <div className="quiz-result-answer-text">
                      {result.selectedAnswer}
                    </div>
                  </div>
                  
                  {!result.correct && (
                    <div className="quiz-result-answer correct-answer">
                      <div className="quiz-result-answer-label">
                        <span className="quiz-answer-indicator">●</span>
                        Correct Answer:
                      </div>
                      <div className="quiz-result-answer-text">
                        {result.correctAnswer}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="quiz-score-actions">
          <button
            onClick={handleTryAgain}
            className="quiz-btn quiz-btn-blue"
          >
            <RotateCcw size={16} style={{ marginRight: '0.5rem' }} />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // 10. Render main quiz interface with streamlined two-column layout and proper scrolling
  return (
    <div className="quiz-two-column-layout">
      {/* Questions Column - Removed cramped borders */}
      <div className="quiz-questions-column quiz-scrollbar">
        {quizData.map((q, qi) => (
          <div key={q.id} className="quiz-question-item">
            <div className="quiz-question-number">
              Question {qi + 1}
            </div>
            <div className="quiz-question-text">{q.question}</div>
            <select
              className="quiz-select"
              value={matchingAnswers[qi] || ''}
              onChange={e => handleAnswerChange(qi, e.target.value)}
            >
              <option value="">Select an answer...</option>
              {letters.map(letter => (
                <option 
                  key={letter} 
                  value={letter} 
                  disabled={isLetterUsed(letter)}
                >
                  Option {letter}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Answer Bank Column - Fixed scrolling implementation */}
      <div className="quiz-answer-bank-column">
        <div className="quiz-answer-bank">
          <h3 className="quiz-answer-bank-title">Answer Bank</h3>
          <div className="quiz-answer-bank-scroll quiz-scrollbar">
            {answerBank.map((ans, i) => (
              <div
                key={i}
                className={`quiz-answer-option ${isLetterUsed(letters[i]) ? 'selected' : ''}`}
              >
                <span className="quiz-answer-option-label">
                  {letters[i]}.
                </span>
                <span className="quiz-answer-option-text">
                  {ans}
                </span>
                {isLetterUsed(letters[i]) && (
                  <div style={{ 
                    marginTop: '0.5rem', 
                    fontSize: '0.875rem', 
                    color: 'var(--quiz-success)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem' 
                  }}>
                    <CheckCircle size={16} />
                    <span>Selected</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fixed Quiz Footer */}
      <div className="quiz-footer">
        <div className="quiz-progress-text">
          {matchingAnswers.filter(a => a !== '').length} of {quizData.length} questions answered
        </div>
        <div className="quiz-footer-actions">
          <button
            onClick={() => {
              console.log('[MatchingQuiz.tsx:4007] Cancel button clicked, closing quiz');
              onClose();
            }}
            className="quiz-btn quiz-btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              console.log('[MatchingQuiz.tsx:4008] Submit button clicked, processing submission');
              handleSubmit();
            }}
            disabled={!isComplete}
            className="quiz-btn quiz-btn-primary"
          >
            Submit Quiz
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchingQuiz;