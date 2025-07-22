// FillInBlankQuiz.tsx
import React, { useState, useEffect } from 'react';
import { IQuizQuestion, IFillInBlankQuestion } from '@/app/Library/Definitions/Definitions';
import QuizBase from './QuizBase';

interface FillInBlankQuizProps {
  quizData: IQuizQuestion[];
  onSubmit: (results: { id: string; correct: boolean }[]) => void;
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
  const results = quizData.map((q, i) => ({
    id: q.id,
    correct:
      answers[i].trim().toLowerCase() ===
      (q as IFillInBlankQuestion)
        .correctAnswer
        .toString()
        .trim()
        .toLowerCase(),
  }));
  onSubmit(results);
};

  const isAnswerSelected = (answer: string) => answers.includes(answer);
  
  // Footer with action buttons
  const footerContent = (
    <div className="flex justify-end gap-4">
      <button 
        onClick={onClose} 
        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={handleSubmit}
        disabled={answers.some(answer => !answer)}
        className={`px-4 py-2 rounded-md transition-colors ${
          !answers.some(answer => !answer) 
            ? 'bg-blue-600 hover:bg-blue-700 text-white' 
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        Submit
      </button>
    </div>
  );

  return (
    <QuizBase 
      title="Fill in the Blanks" 
      onClose={onClose} 
      showScore={showScore}
      footerContent={footerContent}
    >
      <div className="grid grid-cols-[3fr,2fr] gap-8 p-6 h-full">
        {/* Questions Section with independent scroll */}
        <div className="overflow-y-auto pr-4 max-h-full">
          <div className="space-y-6">
            {quizData.map((question, index) => (
              <div key={question.id} className="bg-gray-50 p-4 rounded-lg shadow-sm">
                <div className="text-sm text-gray-600 mb-2">Question {index + 1}</div>
                <div className="text-gray-900 mb-4">{(question as IFillInBlankQuestion).questionText}</div>
                <select
                  value={answers[index] || 'blank'}
                  onChange={(e) => handleAnswerSelect(index, e.target.value)}
                  className="w-full p-2 border rounded-md bg-white hover:border-blue-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
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
        </div>

        {/* Concept Bank Section with independent scroll */}
        <div className="overflow-y-auto max-h-full">
          <div className="bg-gray-50 p-4 rounded-lg shadow-sm h-full">
            <h3 className="font-semibold text-lg mb-4 text-gray-900 sticky top-0 bg-gray-50 pt-1 pb-2">Concept Bank</h3>
            <div className="space-y-3">
              {allAnswers.map(answer => (
                <div 
                  key={answer} 
                  className={`p-3 bg-white rounded-lg border border-gray-200 shadow-sm transition-all ${
                    isAnswerSelected(answer) 
                      ? 'line-through text-gray-400' 
                      : 'text-gray-800 hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  {answer}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </QuizBase>
  );
};

export default FillInBlankQuiz;