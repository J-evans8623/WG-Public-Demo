'use client';

import React from 'react';
import { CueStackProps, colorThemes } from '@/app/Archived/Definitions/Definitions';
import { useDocumentContext } from '../Context/DocumentProvider' // Import the DocumentProvider context

function CueStack({ cueCardCount, onClick }: CueStackProps) {
  const { bloomDepth, colorTheme } = useDocumentContext(); // Get Bloom Depth and Color Theme from DocumentProvider

  // Get the colors from the selected color theme
  const themeColors = colorThemes[colorTheme];

  // Limit the stack to the maximum number of cards based on the Bloom Depth
  const visibleCards = Math.min(cueCardCount, bloomDepth);

  return (
    <div
      className="relative w-16 h-12 cursor-pointer"
      onClick={onClick}
      title="Click to add a new cue card"
      style={{ top: '30px' }} // Lower the entire stack by setting a top margin
    >
      {Array.from({ length: visibleCards }).map((_, index) => (
        <div
          key={index}
          className="absolute shadow-lg"
          style={{
            width: '100%',
            height: '100%',
            top: `-${index * 6}px`, // Negative value to stack upwards
            left: `${index * 6}px`, // Positive value to stack to the right
            zIndex: visibleCards - index,
            backgroundColor: themeColors[index], // Use colors from the selected theme
          }}
        />
      ))}
    </div>
  );
}

export default CueStack;
