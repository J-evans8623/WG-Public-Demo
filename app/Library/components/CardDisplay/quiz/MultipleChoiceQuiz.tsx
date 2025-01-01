// MultipleChoiceQuiz.tsx

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import './MultipleChoiceQuiz.css';
import { IMultipleChoiceQuestion } from '@/app/Library/Definitions/Definitions';

interface MultipleChoiceQuizProps {
  title: string;
  questions: IMultipleChoiceQuestion[];
  onComplete: (score: number) => void;
  onClose: () => void;
}

const MultipleChoiceQuiz: React.FC<MultipleChoiceQuizProps> = ({ 
  title, 
  questions, 
  onComplete, 
  onClose 
}) => {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleOptionSelect = (questionId: string, option: string): void => {
    setSelectedOptions((prev) => ({ ...prev, [questionId]: option }));
  };

  const calculateScore = (): number => {
    return questions.reduce((score, question) => (
      selectedOptions[question.id] === question.correctAnswer ? score + 1 : score
    ), 0);
  };

  const handleSubmit = (): void => {
    const score = calculateScore();
    onComplete(score);
  };

  const modalContent = (
    <div className="mcq-modal-container">
      <div className="mcq-modal">
        <h2 className="mcq-title">{title}</h2>
        
        <div className="mcq-content">
          {questions.map((question, index) => (
            <div key={question.id} className="mcq-question-container">
              <div className="mcq-question-number">Question {index + 1}</div>
              <div className="mcq-question-text">{question.question}</div>
              <div className="mcq-options-container">
                {question.options.map((option) => (
                  <label key={option} className="mcq-option">
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      checked={selectedOptions[question.id] === option}
                      onChange={() => handleOptionSelect(question.id, option)}
                      className="mcq-radio"
                    />
                    <span className="mcq-radio-custom"></span>
                    <span className="mcq-option-text">{option}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mcq-button-group">
          <button onClick={onClose} className="mcq-close-btn">
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            className="mcq-submit-btn"
            disabled={Object.keys(selectedOptions).length !== questions.length}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(
    <>
      <div className="mcq-modal-backdrop" onClick={onClose}></div>
      {modalContent}
    </>,
    document.body
  );
};

export default MultipleChoiceQuiz;