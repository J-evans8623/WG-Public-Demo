import React, { useState } from 'react';
import './MatchingQuizModal.css';

interface MatchingQuizModalProps {
  quiz: { question: string; answer: string }[];
  scrambledAnswers: string[];
  onClose: () => void;
}

const MatchingQuizModal: React.FC<MatchingQuizModalProps> = ({ quiz, scrambledAnswers, onClose }) => {
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
        if (selectedAnswer === quiz[index].answer) {
          score++;
        }
      }
    });
    alert(`Your score: ${score}/${quiz.length}`);
  };

  return (
    <div className="quiz-modal">
      <h2>Matching Quiz</h2>

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
          <h3>Options:</h3>
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
  );
};

export default MatchingQuizModal;
