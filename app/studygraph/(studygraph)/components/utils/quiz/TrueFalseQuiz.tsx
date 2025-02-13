// TrueFalseQuiz.tsx
import React, { useState } from 'react';
import { IQuizQuestion, ITrueFalseQuestion } from '@/app/Library/Definitions/Definitions';
import QuizBase from './QuizBase';

interface TrueFalseQuizProps {
  quizData: IQuizQuestion[];
  onSubmit: (score: number, total: number) => void;
  onClose: () => void;
}

const TrueFalseQuiz: React.FC<TrueFalseQuizProps> = ({ quizData, onSubmit, onClose }) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, boolean | null>>({});
  const [showScore, setShowScore] = useState(false);

  const handleAnswerSelect = (questionId: string, answer: boolean) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = () => {
    const correct = quizData.reduce((score, question) =>
      selectedAnswers[question.id] === question.correctAnswer ? score + 1 : score, 0);
    onSubmit(correct, quizData.length);
  };

  return (
    <QuizBase title="True/False Quiz" onClose={onClose} showScore={showScore}>
      <div className="flex-1 p-6 space-y-6">
        {quizData.map((question, index) => (
          <div key={question.id} className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-2">Question {index + 1}</div>
            <div className="text-lg mb-4">{question.question}</div>
            <div className="flex gap-4 justify-center">
              {[true, false].map((option) => (
                <label key={option.toString()} className="flex-1">
                  <div className="flex items-center justify-center p-3 bg-white rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name={question.id}
                      value={option.toString()}
                      checked={selectedAnswers[question.id] === option}
                      onChange={() => handleAnswerSelect(question.id, option)}
                      className="mr-3"
                    />
                    <span>{option ? 'True' : 'False'}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto p-4 border-t flex justify-end gap-4">
        <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          disabled={Object.values(selectedAnswers).includes(null)}
        >
          Submit
        </button>
      </div>
    </QuizBase>
  );
};

export default TrueFalseQuiz;