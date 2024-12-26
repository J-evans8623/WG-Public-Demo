// bloom-maps/app/Library/components/MatchingQuizModal.tsx

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom'; // Import ReactDOM for portals
import './MatchingQuizModal.css';
import { IQuizQuestion } from '../../Definitions/Definitions';

interface MatchingQuizModalProps {
  title: string; // New prop for the quiz title
  quiz: IQuizQuestion[];
  scrambledAnswers: string[];
  onClose: () => void;
}

const MatchingQuizModal: React.FC<MatchingQuizModalProps> = ({ title, quiz, scrambledAnswers, onClose }) => {
  const [userAnswers, setUserAnswers] = useState<string[]>(Array(quiz.length).fill(''));

  const letters = scrambledAnswers.map((_, i) => String.fromCharCode(65 + i)); // ['A', 'B', 'C', ...]

  const handleAnswerChange = (index: number, answer: string) => {
    const updatedAnswers = [...userAnswers];
    updatedAnswers[index] = answer;
    setUserAnswers(updatedAnswers);
  };

  const calculateScore = () => {
    let score = 0;
    userAnswers.forEach((userAnswer, index) => {
      if (userAnswer) {
        const selectedIndex = userAnswer.charCodeAt(0) - 65; // 'A' -> 0
        const selectedAnswer = scrambledAnswers[selectedIndex];
        if (selectedAnswer === quiz[index].correctAnswer) {
          score++;
        }
      }
    });
    alert(`Your score: ${score}/${quiz.length}`);
  };

  // Prevent scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Modal content
  const modalContent = (
    <div className="quiz-modal-container">
      <div className="quiz-modal">
        <h2 className="quiz-title">{title}</h2> {/* Display the custom title */}

        <div className="quiz-content">
          {/* Left Column: Questions with dropdowns */}
          <div className="question-section">
            {quiz.map((q, index) => (
              <div key={index} className="question-item">
                <div className="question-text">
                  {index + 1}. {q.question}
                </div>
                <select
                  className="answer-dropdown"
                  value={userAnswers[index]}
                  onChange={(e) => handleAnswerChange(index, e.target.value)}
                >
                  <option value="">Select</option>
                  {letters.map((letter) => (
                    <option key={letter} value={letter}>
                      {letter}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Right Column: Scrambled answers with letters */}
          <div className="answer-section">
            {scrambledAnswers.map((answer, index) => (
              <div key={index} className="answer-item">
                {letters[index]}. {answer}
              </div>
            ))}
          </div>
        </div>

        <div className="button-group">
          <button onClick={onClose} className="close-btn">
            Close
          </button>
          <button onClick={calculateScore} className="submit-btn">
            Submit
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(
    <>
      {/* Backdrop */}
      <div className="quiz-modal-backdrop" onClick={onClose}></div>
      {modalContent}
    </>,
    document.body
  );
};

export default MatchingQuizModal;
