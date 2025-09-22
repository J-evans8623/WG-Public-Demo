// app/studygraph/(studygraph)/components/utils/quiz/MultipleChoiceQuiz.tsx
// MultipleChoiceQuiz.tsx
import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { IQuizQuestion, IMultipleChoiceQuestion } from '@/app/Library/Definitions/Definitions';
import QuizBase from '@/app/studygraph/(studygraph)/components/utils/quiz/QuizBase';
// update - 1
import { type ProgressHandle, type ProgressSnapshot } from './scoringUtils';

interface MultipleChoiceQuizProps {
  quizData: IQuizQuestion[];
  onSubmit: (results: { id: string; correct: boolean }[]) => void;
  onClose: () => void;
}

const MultipleChoiceQuiz = forwardRef<ProgressHandle, MultipleChoiceQuizProps>(function MultipleChoiceQuiz(
  { quizData, onSubmit, onClose },
  ref
) {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [showScore, setShowScore] = useState(false);

  // update - 2: expose getProgress for early-exit scoring
  useImperativeHandle(ref, () => ({
    getProgress: (): ProgressSnapshot<Record<string, string>> => {
      console.log('[MultipleChoiceQuiz.tsx:5101] getProgress invoked', { answered: Object.keys(selectedOptions).length });
      return { answers: selectedOptions };
    },
  }), [selectedOptions]);

  const handleOptionSelect = (questionId: string, option: string) => {
    setSelectedOptions((prev) => ({ ...prev, [questionId]: option }));
  };

  const handleSubmit = () => {
    const results = quizData.map((q) => ({
      id: q.id,
      correct:
        (selectedOptions[q.id] as string) ===
        (q as IMultipleChoiceQuestion).correctAnswer,
    }));
    onSubmit(results);
  };

  const allQuestionsAnswered = Object.keys(selectedOptions).length === quizData.length;

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
      title="Multiple Choice Quiz" 
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
              <div className="space-y-3">
                {(question as IMultipleChoiceQuestion).options.map((option) => (
                  <label
                    key={option}
                    className={`flex items-center p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedOptions[question.id] === option 
                        ? 'border-blue-500 ring-2 ring-blue-200' 
                        : ''
                    }`}
                  >
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
      </div>
    </QuizBase>
  );
});

export default MultipleChoiceQuiz;
