// bloom-maps/app/ui/CueStack.tsx

'use client';

import React from 'react';
import { CueStackProps, colorThemes } from '@/app/Definitions/Definitions';
import { useDocumentContext } from './context/DocumentProvider'; // Import the DocumentProvider context

function CueStack({ cueCardCount, onClick }: CueStackProps) {
  const { bloomDepth, colorTheme } = useDocumentContext(); // Get Bloom Depth and Color Theme from DocumentProvider

  // Get the colors from the selected color theme
  const themeColors = colorThemes[colorTheme];

  // Limit the stack to the maximum number of cards based on the Bloom Depth
  const visibleCards = Math.min(cueCardCount, bloomDepth);

  return (
    <div
      className="relative w-8 h-12 cursor-pointer"
      onClick={onClick}
      title="Click to add a new cue card"
    >
      {Array.from({ length: visibleCards }).map((_, index) => (
        <div
          key={index}
          className="absolute rounded-lg shadow-lg"
          style={{
            width: '100%',
            height: '100%',
            top: `${index * 5}px`,
            left: `${index * 5}px`,
            zIndex: visibleCards - index,
            backgroundColor: themeColors[index], // Use colors from the selected theme
          }}
        />
      ))}
    </div>
  );
}

export default CueStack;
