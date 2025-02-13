// ScoreDisplay.tsx
import React from 'react';

interface ScoreDisplayProps {
  score: number;
  total: number;
  onExit: () => void;
}

const ScoreDisplay: React.FC<ScoreDisplayProps> = ({ score, total, onExit }) => {
  const percentage = (score / total) * 100;
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="mb-6">
        <div className="text-4xl font-bold text-gray-900 mb-2">
          {score}/{total}
        </div>
        <div className="text-xl text-gray-600">
          {percentage.toFixed(0)}% Correct
        </div>
      </div>
      <div className="text-gray-600 mb-8">
        {percentage >= 80 ? "Great job! 🎉" :
         percentage >= 60 ? "Good effort! 💪" :
         "Keep practicing! 📚"}
      </div>
      <button
        onClick={onExit}
        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        Back to Study
      </button>
    </div>
  );
};

export default ScoreDisplay;
