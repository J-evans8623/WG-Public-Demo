// bloom-maps/app/ui/CueStack.tsx

'use client';

import React from 'react';
import { CueStackProps } from '@/app/Definitions/Definitions';
import { useGlobalSettings } from './context/old/GlobalSettingsContext'; // Import the global settings context

function CueStack({ cueCardCount, colorTheme, onClick }: CueStackProps) {
  const { bloomDepth } = useGlobalSettings(); // Get the Bloom Depth from global settings

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
            backgroundColor: colorTheme[index],
          }}
        />
      ))}
    </div>
  );
}

export default CueStack;
