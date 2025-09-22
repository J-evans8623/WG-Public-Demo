// TrueFalseQuiz.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { IQuizQuestion, ITrueFalseQuestion } from '@/app/Library/Definitions/Definitions';
import QuizBase from './QuizBase';

interface TrueFalseQuizProps {
  quizData: IQuizQuestion[];
  onSubmit: (results: { id: string; correct: boolean }[]) => void;
  onClose: () => void;
   onProgress?: (partial: { id: string; correct: boolean }[], details?: any[]) => void; 
}

const TrueFalseQuiz: React.FC<TrueFalseQuizProps> = ({ quizData, onSubmit, onClose, onProgress }) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, boolean | null>>({});
  const [showScore, setShowScore] = useState(false);

  const handleAnswerSelect = (questionId: string, answer: boolean) => {
    setSelectedAnswers((prev) => {
      const next = { ...prev, [questionId]: answer };
      emitProgress(next);
      return next;
    });
  };

const handleSubmit = () => {
  const results = quizData.map((q) => ({
    id: q.id,
    correct:
      (selectedAnswers[q.id] as boolean) ===
      (q as ITrueFalseQuestion).correctAnswer,
  }));
  onSubmit(results);
};

  const allQuestionsAnswered = quizData.every(question => 
    selectedAnswers[question.id] === true || selectedAnswers[question.id] === false
  );

  /**
     * emitProgress
     * @description
     *   Build partial correctness and optional details arrays from current selection state so the
     *   overlay can grade early exits. Unanswered questions are considered incorrect. O(N).
     */
    const emitProgress = useCallback( (state: Record<string, boolean | null>) => { // update - 2
    if (!onProgress) return;
    const partial = quizData.map((q) => {
      const picked = state[q.id];
      if (picked === null || typeof picked === 'undefined') return { id: q.id, correct: false };
      const correct = (q as ITrueFalseQuestion).correctAnswer;
      return { id: q.id, correct: picked === correct };
    });
    const details = quizData.map((q) => {
      const picked = state[q.id];
      if (picked === null || typeof picked === 'undefined') return { id: q.id, isCorrect: false, userAnswer: null };
      const correct = (q as ITrueFalseQuestion).correctAnswer;
      return { id: q.id, isCorrect: picked === correct, userAnswer: picked };
    });
    onProgress(partial, details);
  }, [onProgress, quizData] );

  useEffect(() => {
    // initialize with unanswered
    const init: Record<string, boolean | null> = {};
    quizData.forEach((q) => (init[q.id] = null));
    setSelectedAnswers(init);
    emitProgress(init); // update - 3
  }, [emitProgress, quizData]);
  

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
        disabled={!allQuestionsAnswered}
        className={`px-4 py-2 rounded-md transition-colors ${
          allQuestionsAnswered
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
      title="True/False Quiz" 
      onClose={onClose} 
      showScore={showScore}
      footerContent={footerContent}
    >
      <div className="p-6 overflow-y-auto">
        <div className="space-y-6">
          {quizData.map((question, index) => (
            <div key={question.id} className="bg-gray-50 p-4 rounded-lg shadow-sm">
              <div className="text-sm text-gray-600 mb-2">Question {index + 1}</div>
              <div className="text-gray-900 mb-4">{question.question}</div>
              <div className="flex gap-4 justify-center">
                {[true, false].map((option) => (
                  <label key={option.toString()} className="flex-1">
                    <div 
                      className={`flex items-center justify-center p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedAnswers[question.id] === option 
                          ? 'border-blue-500 ring-2 ring-blue-200' 
                          : ''
                      }`}
                    >
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
      </div>
    </QuizBase>
  );
};

export default TrueFalseQuiz;