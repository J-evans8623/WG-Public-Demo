// MatchingQuiz.tsx
import React, { useState, useEffect } from 'react';
import { IQuizQuestion } from '@/app/Library/Definitions/Definitions';
import QuizBase from './QuizBase';

interface MatchingQuizProps {
  quizData: IQuizQuestion[];
  onSubmit: (score: number, total: number) => void;
  onClose: () => void;
}

const MatchingQuiz: React.FC<MatchingQuizProps> = ({ quizData, onSubmit, onClose }) => {
  const [matchingAnswers, setMatchingAnswers] = useState<string[]>([]);
  const [showScore, setShowScore] = useState(false);

  useEffect(() => {
    setMatchingAnswers(Array(quizData.length).fill(''));
  }, [quizData]);

  const letters = quizData.map((_, i) => String.fromCharCode(65 + i));
  const scrambledAnswers = quizData.map(q => q.correctAnswer as string);

  const handleAnswerChange = (index: number, answer: string) => {
    const updatedAnswers = [...matchingAnswers];
    updatedAnswers[index] = answer;
    setMatchingAnswers(updatedAnswers);
  };

  const handleSubmit = () => {
    let correct = 0;
    matchingAnswers.forEach((answer, index) => {
      if (answer) {
        const selectedIndex = answer.charCodeAt(0) - 65;
        const selectedAnswer = scrambledAnswers[selectedIndex];
        if (selectedAnswer === quizData[index].correctAnswer) {
          correct++;
        }
      }
    });
    onSubmit(correct, quizData.length);
  };

  // Check if all questions have been answered
  const isComplete = matchingAnswers.every(answer => answer !== '');
  
  // Check if a letter option is selected
  const isLetterSelected = (letter: string) => matchingAnswers.includes(letter);

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
        disabled={!isComplete}
        className={`px-4 py-2 rounded-md transition-colors ${
          isComplete 
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
      title="Matching Quiz" 
      onClose={onClose} 
      showScore={showScore}
      footerContent={footerContent}
    >
      <div className="grid grid-cols-[3fr,2fr] gap-8 p-6 h-full">
        {/* Questions Section with independent scroll */}
        <div className="overflow-y-auto pr-4 max-h-full">
          <div className="space-y-6">
            {quizData.map((q, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg shadow-sm">
                <div className="text-sm text-gray-600 mb-2">Question {index + 1}</div>
                <div className="text-gray-900 mb-4">{q.question}</div>
                <select
                  className="w-full p-2 border rounded-md bg-white hover:border-blue-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                  value={matchingAnswers[index] || ''}
                  onChange={(e) => handleAnswerChange(index, e.target.value)}
                >
                  <option value="">Select an answer</option>
                  {letters.map((letter) => (
                    <option key={letter} value={letter}>
                      Option {letter}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Answer Bank Section with independent scroll */}
        <div className="overflow-y-auto max-h-full">
          <div className="bg-gray-50 p-4 rounded-lg shadow-sm h-full">
            <h3 className="font-semibold text-lg mb-4 text-gray-900 sticky top-0 bg-gray-50 pt-1 pb-2">Answer Bank</h3>
            <div className="space-y-3">
              {scrambledAnswers.map((answer, index) => (
                <div 
                  key={index} 
                  className={`p-3 bg-white rounded-lg border border-gray-200 shadow-sm transition-all ${
                    isLetterSelected(letters[index]) 
                      ? 'line-through text-gray-400' 
                      : 'text-gray-800'
                  }`}
                >
                  <span className={`font-medium mr-2 ${
                    isLetterSelected(letters[index]) 
                      ? 'text-gray-400' 
                      : 'text-blue-600'
                  }`}>
                    {letters[index]}.
                  </span>
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

export default MatchingQuiz;