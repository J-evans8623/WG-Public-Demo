// FillInBlankQuiz.tsx
import React, { useState, useEffect } from 'react';
import { IQuizQuestion, IFillInBlankQuestion } from '@/app/Library/Definitions/Definitions';
import QuizBase from './QuizBase';

interface FillInBlankQuizProps {
  quizData: IQuizQuestion[];
  onSubmit: (score: number, total: number) => void;
  onClose: () => void;
}

const FillInBlankQuiz: React.FC<FillInBlankQuizProps> = ({ quizData, onSubmit, onClose }) => {
  const [answers, setAnswers] = useState<string[]>([]);
  const [allAnswers, setAllAnswers] = useState<string[]>([]);
  const [showScore, setShowScore] = useState(false);

  useEffect(() => {
    setAnswers(Array(quizData.length).fill(''));
    setAllAnswers(quizData.map(q => (q as IFillInBlankQuestion).correctAnswer as string));
  }, [quizData]);

  const handleAnswerSelect = (questionIndex: number, value: string) => {
    setAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[questionIndex] = value === 'blank' ? '' : value;
      return newAnswers;
    });
  };

  const handleSubmit = () => {
    const correct = quizData.reduce((score, question, index) =>
      answers[index]?.trim().toLowerCase() === (question as IFillInBlankQuestion).correctAnswer.toString().trim().toLowerCase()
        ? score + 1
        : score,
      0
    );
    onSubmit(correct, quizData.length);
  };

  const isAnswerSelected = (answer: string) => answers.includes(answer);

  return (
    <QuizBase title="Fill in the Blanks" onClose={onClose} showScore={showScore}>
      <div className="grid grid-cols-[3fr,2fr] gap-8 h-full p-6">
        <div className="space-y-6 overflow-y-auto">
          {quizData.map((question, index) => (
            <div key={question.id} className="bg-gray-50 p-4 rounded-lg">
              <div className="mb-4">{(question as IFillInBlankQuestion).questionText}</div>
              <select
                value={answers[index] || 'blank'}
                onChange={(e) => handleAnswerSelect(index, e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="blank">Select an answer</option>
                {allAnswers.map(answer => (
                  <option key={answer} value={answer}>
                    {answer}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-4">Concept Bank</h3>
          <div className="space-y-2">
            {allAnswers.map(answer => (
              <div 
                key={answer} 
                className={`p-2 bg-white rounded-lg border cursor-pointer hover:bg-gray-50 transition-all ${
                  isAnswerSelected(answer) ? 'line-through text-gray-400' : ''
                }`}
              >
                {answer}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-auto p-4 border-t flex justify-end gap-4">
        <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          disabled={answers.some(answer => !answer)}
        >
          Submit
        </button>
      </div>
    </QuizBase>
  );
};

export default FillInBlankQuiz;