// bloom-maps/app/ui/PracticeSheetCard.tsx

import React from 'react';

interface PracticeSheetCardProps {
  id: string;
  title: string;
  content: string;
  onOpenFullSize: () => void; // Callback to handle opening full-size view
  onDismiss?: () => void; // Optional callback to handle dismissal
}

const PracticeSheetCard: React.FC<PracticeSheetCardProps> = ({ title, content, onOpenFullSize, onDismiss }) => {
  return (
    <div className="bg-gray-200 p-4 border rounded shadow-sm cursor-pointer" onClick={onOpenFullSize}>
      <div className="flex justify-between">
        <p className="font-bold text-lg">{title}</p>
        {onDismiss && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="text-gray-600 hover:text-gray-800"
            title="Dismiss"
          >
            ×
          </button>
        )}
      </div>
      <p className="text-gray-500 mt-2">{content.substring(0, 100)}...</p>
    </div>
  );
};

export default PracticeSheetCard;
