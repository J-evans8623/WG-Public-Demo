// app/workspace/(studygraph)/components/utils/quiz/MatchingQuiz.tsx
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

import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { IQuizQuestion } from '@/app/Library/Definitions/Definitions';
import { CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import '@/app/workspace/(studygraph)/components/utils/quiz/QuizStyles.css';
// update - 1
import { type ProgressHandle, type ProgressSnapshot } from './scoringUtils';

/**
 * shuffleArray - Fisher–Yates shuffle algorithm implementation for array randomization
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
}

const MatchingQuiz = forwardRef<ProgressHandle, MatchingQuizProps>(function MatchingQuiz(
  { title, quizData, onSubmit, onClose },
  ref
) {
  const [matchingAnswers, setMatchingAnswers] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [quizResults, setQuizResults] = useState<Array<{
    id: string;
    question: string;
    selectedAnswer: string;
    correctAnswer: string;
    correct: boolean;
  }>>([]);

  useEffect(() => {
    console.log('[MatchingQuiz.tsx:4001] Initializing matching answers array for', quizData.length, 'questions');
    setMatchingAnswers(Array(quizData.length).fill(''));
  }, [quizData]);

  const answerBank = useMemo(() => {
    console.log('[MatchingQuiz.tsx:4002] Generating shuffled answer bank from', quizData.length, 'correct answers');
    const allCorrect = quizData.map(q => q.correctAnswer as string);
    return shuffleArray(allCorrect);
  }, [quizData]);

  const letters = answerBank.map((_, i) => String.fromCharCode(65 + i));

  // update - 2: expose progress getter for early-exit scoring
  useImperativeHandle(ref, () => ({
    getProgress: (): ProgressSnapshot<{ answerBank: string[] }> => {
      console.log('[MatchingQuiz.tsx:4991] getProgress invoked', { len: matchingAnswers.length });
      return {
        answers: matchingAnswers,
        evalContext: { answerBank },
      };
    },
  }), [matchingAnswers, answerBank]);

  const handleAnswerChange = (questionIndex: number, letter: string) => {
    console.log('[MatchingQuiz.tsx:4003] Answer changed for question', questionIndex + 1, 'to option', letter);
    const next = [...matchingAnswers];
    next[questionIndex] = letter;
    setMatchingAnswers(next);
  };

  const handleSubmit = () => {
    console.log('[MatchingQuiz.tsx:4004] Processing quiz submission with', matchingAnswers.length, 'answers');
    const results = quizData.map((q, qi) => {
      const letter = matchingAnswers[qi];
      const idx = letter ? letter.charCodeAt(0) - 65 : -1;
      const selectedAnswer = idx >= 0 ? answerBank[idx] : '';
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
    setQuizResults(results);
    setShowResults(true);
    const simpleResults = results.map(r => ({ id: r.id, correct: r.correct }));
    onSubmit(simpleResults, results);
  };

  const handleTryAgain = () => {
    console.log('[MatchingQuiz.tsx:4006] Resetting quiz for new attempt');
    setMatchingAnswers(Array(quizData.length).fill(''));
    setShowResults(false);
    setQuizResults([]);
  };

  const isComplete = matchingAnswers.every(a => a !== '');
  const isLetterUsed = (letter: string) => matchingAnswers.includes(letter);
  const score = quizResults.filter(r => r.correct).length;

  if (showResults) {
    return (
      <div className="quiz-score-container">
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

  return (
    <div className="quiz-two-column-layout">
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
});

export default MatchingQuiz;
