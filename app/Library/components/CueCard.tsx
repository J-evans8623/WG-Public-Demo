// bloom-maps/app/ui/CueCard.tsx

'use client';

import React, { useState } from 'react';
import { CueCardProps, colorThemes } from '@/app/Library/Definitions/Definitions';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider'; // Use the new DocumentProvider context
import { FiX } from 'react-icons/fi'; 

interface CueCardPropsWithBloom extends CueCardProps {
  bloomLevel: 1 | 2 | 3 | 4 | 5 | 6;
  conceptNodeTitle: string; // New prop
  onDismiss?: () => void;
  source?: string;
}

// Mapping bloom levels to hierarchy names
const bloomLevelNames = {
  1: 'Remember',
  2: 'Understand',
  3: 'Apply',
  4: 'Analyze',
  5: 'Evaluate',
  6: 'Create',
};
const CueCard: React.FC<CueCardPropsWithBloom> = React.memo(
  ({ title, content, bloomLevel, conceptNodeTitle, onDismiss, source }) => {
    const [showTitle, setShowTitle] = useState(true);
    const { state } = useDocumentContext();
    const { colorTheme } = state;

    const handleClick = () => {
      setShowTitle(!showTitle);
    };

    // Determine the color for the dot
    const themeColors = colorThemes[colorTheme];
    const bloomColor = themeColors[bloomLevel - 1] || colorThemes['gray'][0];

    return (
      <div
        className="bg-white p-4 border rounded shadow-sm min-w-[150px] h-60 flex flex-col relative cursor-pointer overflow-hidden"
        onClick={handleClick}
      >
        {/* Dismiss Button */}
        {onDismiss && (
          <button
            className="absolute top-2 right-2 text-gray-600 hover:text-gray-800"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            title="Dismiss"
          >
            <FiX size={16} />
          </button>
        )}

        {/* Header: Concept Node Title and Colored Dot */}
        <div className="flex items-center mb-4">
          <div
            className="w-3 h-3 rounded-full mr-2"
            style={{ backgroundColor: bloomColor }}
            title={`Bloom Level: ${bloomLevelNames[bloomLevel]}`}
          ></div>
          <span className="text-sm text-gray-800 font-medium">{conceptNodeTitle}</span>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 px-2">
          {showTitle ? (
            // Front of the card (Title View)
            <div className="h-full flex items-center justify-center">
              <h3 className="font-bold text-xl text-gray-800 text-center leading-tight font-sans break-words">
                {title}
              </h3>
            </div>
          ) : (
            // Back of the card (Content View)
            <div className="py-2">
              <p className="text-xl text-gray-600 text-left leading-relaxed font-sans break-words">
                {content}
              </p>
            </div>
          )}
        </div>

        {/* Footer: Source Display */}
        {source && (
          <div className="text-xs text-gray-500 mt-4">
            <span>Source: {source}</span>
          </div>
        )}
      </div>
    );
  }
);

// Add a displayName to the memoized component
CueCard.displayName = 'CueCard';

export default CueCard;
