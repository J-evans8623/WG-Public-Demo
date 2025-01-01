/**
 * TrueFalseQuiz.tsx
 * 
 * Component responsible for rendering and managing true/false quiz questions.
 * Responsibilities:
 * - Render true/false questions.
 * - Handle user selection of answers and calculate the score.
 * - Provide feedback upon completion of the quiz.
 * 
 * Dependencies:
 * - ITrueFalseQuestion interface from Definitions.tsx
 * - Shared styling from MatchingQuizModal.css
 */

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import './TrueFalseQuiz.css';
import { ITrueFalseQuestion } from '@/app/Library/Definitions/Definitions';

interface TrueFalseQuizProps {
  title: string;
  questions: ITrueFalseQuestion[];
  onComplete: (score: number) => void;
  onClose: () => void;
}

const TrueFalseQuiz: React.FC<TrueFalseQuizProps> = ({
  title,
  questions,
  onComplete,
  onClose
}) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, boolean | null>>(
    Object.fromEntries(questions.map((q) => [q.id, null]))
  );

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleAnswerSelect = (questionId: string, answer: boolean): void => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const calculateScore = (): number => {
    return questions.reduce((score, question) => (
      selectedAnswers[question.id] === question.correctAnswer ? score + 1 : score
    ), 0);
  };

  const handleSubmit = (): void => {
    const score = calculateScore();
    onComplete(score);
  };

  const modalContent = (
    <div className="tf-modal-container">
      <div className="tf-modal">
        <h2 className="tf-title">{title}</h2>
        
        <div className="tf-content">
          {questions.map((question, index) => (
            <div key={question.id} className="tf-question-container">
              <div className="tf-question-number">Question {index + 1}</div>
              <div className="tf-question-text">{question.question}</div>
              <div className="tf-options-container">
                {[true, false].map((option) => (
                  <label key={option.toString()} className="tf-option">
                    <input
                      type="radio"
                      name={question.id}
                      value={option.toString()}
                      checked={selectedAnswers[question.id] === option}
                      onChange={() => handleAnswerSelect(question.id, option)}
                      className="tf-radio"
                    />
                    <span className="tf-radio-custom"></span>
                    <span className="tf-option-text">
                      {option ? 'True' : 'False'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="tf-button-group">
          <button onClick={onClose} className="tf-close-btn">
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            className="tf-submit-btn"
            disabled={Object.values(selectedAnswers).includes(null)}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(
    <>
      <div className="tf-modal-backdrop" onClick={onClose}></div>
      {modalContent}
    </>,
    document.body
  );
};

export default TrueFalseQuiz;