import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import './FIB.css';
import { IFillInBlankQuestion } from '@/app/Library/Definitions/Definitions';

interface FillInBlankQuizProps {
  title: string;
  questions: IFillInBlankQuestion[];
  onComplete: (score: number) => void;
  onClose: () => void;
}

const FillInBlankQuiz: React.FC<FillInBlankQuizProps> = ({ title, questions, onComplete, onClose }) => {
  const [userAnswers, setUserAnswers] = useState<string[]>(questions.map(() => ''));
  const [availableAnswers, setAvailableAnswers] = useState<string[]>([]);
  
  useEffect(() => {
    // Initialize available answers from all correct answers
    const answers = questions.map(q => q.correctAnswer);
    setAvailableAnswers(answers);
  }, [questions]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleAnswerSelect = (questionIndex: number, value: string): void => {
    setUserAnswers(prev => {
      const newAnswers = [...prev];
      // If there was a previous answer, add it back to available answers
      if (prev[questionIndex] && prev[questionIndex] !== 'blank') {
        setAvailableAnswers(curr => [...curr, prev[questionIndex]]);
      }
      // If selecting a new answer (not 'blank'), remove it from available answers
      if (value !== 'blank') {
        setAvailableAnswers(curr => curr.filter(answer => answer !== value));
      }
      newAnswers[questionIndex] = value;
      return newAnswers;
    });
  };

  const validateAnswers = (): number => {
    return questions.reduce((score, question, index) => {
      return userAnswers[index]?.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase()
        ? score + 1
        : score;
    }, 0);
  };

  const renderQuestion = (question: IFillInBlankQuestion, index: number): React.ReactNode => {
    const currentAnswer = userAnswers[index];
    const options = ['blank', ...availableAnswers];
    if (currentAnswer && currentAnswer !== 'blank') {
      options.push(currentAnswer);
    }

    return (
      <div key={question.id} className="question-item">
        <div className="question-text">
          {question.questionText}
        </div>
        <select
          value={currentAnswer || 'blank'}
          onChange={(e) => handleAnswerSelect(index, e.target.value)}
          className="answer-dropdown"
        >
          <option value="blank">Select an answer</option>
          {options.filter(opt => opt !== 'blank').map(answer => (
            <option key={answer} value={answer}>
              {answer}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const handleSubmit = (): void => {
    const score = validateAnswers();
    onComplete(score);
  };

  const modalContent = (
    <div className="quiz-modal-container">
      <div className="quiz-modal">
        <h2 className="quiz-title">{title}</h2>
        
        <div className="quiz-content">
          <div className="question-section">
            <h3 className="section-title">Questions</h3>
            {questions.map((question, index) => renderQuestion(question, index))}
          </div>

          <div className="concept-bank">
            <h3 className="section-title">Concept Bank</h3>
            <div className="concept-list">
              {questions.map(q => q.correctAnswer).map((answer, index) => (
                <div 
                  key={index}
                  className={`concept-item ${userAnswers.includes(answer) ? 'selected' : ''}`}
                >
                  {answer}
                </div>
              ))}
            </div>
          </div>
          <div className="button-group">
          <button onClick={onClose} className="close-btn">
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            className="submit-btn"
            disabled={userAnswers.some(answer => !answer || answer === 'blank')}
          >
            Submit
          </button>
        </div>
        </div>       
      </div>
    </div>
  );

  return ReactDOM.createPortal(
    <>
      <div className="quiz-modal-backdrop" onClick={onClose}></div>
      {modalContent}
    </>,
    document.body
  );
};

export default FillInBlankQuiz;