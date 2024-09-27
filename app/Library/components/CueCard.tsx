// bloom-maps/app/ui/CueCard.tsx

'use client';

import React, { useState } from 'react';
import { CueCardProps, colorThemes } from '@/app/Library/Definitions/Definitions';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider'; // Use the new DocumentProvider context

interface CueCardPropsWithBloom extends CueCardProps {
  bloomLevel: 1 | 2 | 3 | 4 | 5 | 6; // Add bloom level as a required prop
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

function CueCard({ title, content, bloomLevel }: CueCardPropsWithBloom) {
  const [showTitle, setShowTitle] = useState(true);
  const { state } = useDocumentContext(); // Use the new context to get the state
  const { colorTheme } = state; // Extract the colorTheme from state

  // Function to toggle between title and content
  const handleClick = () => {
    setShowTitle(!showTitle);
  };

  // Determine the color for the dot
  const themeColors = colorThemes[colorTheme];
  const bloomColor = themeColors[bloomLevel - 1] || colorThemes['gray'][0]; // Use gray if no bloom level is specified

  return (
    <div
      className="bg-white p-4 border rounded shadow-sm min-w-[150px] h-60 flex flex-col cursor-pointer relative"
      onClick={handleClick}
    >
      {/* Colored dot representing bloom level */}
      <div
        className="absolute top-2 left-2 w-3 h-3 rounded-full"
        style={{ backgroundColor: bloomColor }}
        title={`Bloom Level: ${bloomLevelNames[bloomLevel]}`} // Use the mapped hierarchy name
      ></div>

      {/* Scrollable content area */}
      <div className="mt-4 flex-grow overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 px-2">
        {showTitle ? (
          <h3 className="font-bold text-xl text-gray-800 text-center leading-tight font-sans break-words">
            {title}
          </h3>
        ) : (
          <p className="text-xl text-gray-600 text-center leading-relaxed font-sans break-words">
            {content}
          </p>
        )}
      </div>
    </div>
  );
}

export default CueCard;
