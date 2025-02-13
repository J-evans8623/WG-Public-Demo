// MultipleChoiceQuiz.tsx
import React, { useState } from 'react';
import { IQuizQuestion, IMultipleChoiceQuestion } from '@/app/Library/Definitions/Definitions';
import QuizBase from './QuizBase';

interface MultipleChoiceQuizProps {
  quizData: IQuizQuestion[];
  onSubmit: (score: number, total: number) => void;
  onClose: () => void;
}

const MultipleChoiceQuiz: React.FC<MultipleChoiceQuizProps> = ({ quizData, onSubmit, onClose }) => {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [showScore, setShowScore] = useState(false);

  const handleOptionSelect = (questionId: string, option: string) => {
    setSelectedOptions((prev) => ({ ...prev, [questionId]: option }));
  };

  const handleSubmit = () => {
    const correct = quizData.reduce((score, question) =>
      selectedOptions[question.id] === question.correctAnswer ? score + 1 : score, 0);
    onSubmit(correct, quizData.length);
  };

  return (
    <QuizBase title="Multiple Choice Quiz" onClose={onClose} showScore={showScore}>
      <div className="flex-1 p-6 space-y-6">
        {quizData.map((question, index) => (
          <div key={question.id} className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-2">Question {index + 1}</div>
            <div className="text-lg mb-4">{question.question}</div>
            <div className="space-y-3">
              {(question as IMultipleChoiceQuestion).options.map((option) => (
                <label key={option} className="flex items-center p-3 bg-white rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="radio"
                    name={question.id}
                    value={option}
                    checked={selectedOptions[question.id] === option}
                    onChange={() => handleOptionSelect(question.id, option)}
                    className="mr-3"
                  />
                  <span>{option}</span>
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
          disabled={Object.keys(selectedOptions).length !== quizData.length}
        >
          Submit
        </button>
      </div>
    </QuizBase>
  );
};

export default MultipleChoiceQuiz;