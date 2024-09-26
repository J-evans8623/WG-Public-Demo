'use client';

import React from 'react';
import { CueStackProps, colorThemes } from '@/app/Library/Definitions/Definitions';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider'; 
import { useCueCardContext } from '@/app/Library/Context/CueCardContext'; // Import CueCardContext

function CueStack({ nodeId, onClick }: CueStackProps & { nodeId: string }) {
  const { state } = useDocumentContext(); // Use the new context to get the state
  const { bloomDepth, colorTheme } = state; // Extract Bloom Depth and Color Theme from state
  const { selectCueCards } = useCueCardContext(); // Use CueCardContext to select cue cards for a specific node

  // Get the colors from the selected color theme
  const themeColors = colorThemes[colorTheme];

  // Get the cue cards for the given nodeId
  const cueCards = selectCueCards(nodeId); // Fetch the cue cards from the context using the node ID

  // Limit the stack to the maximum number of cards based on the Bloom Depth
  const visibleCards = Math.min(cueCards.length, bloomDepth);

  return (
    <div
      className="relative w-12 h-8 cursor-pointer"
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
            top: `-${index * 5}px`, // Negative value to stack upwards
            left: `${index * 5}px`, // Positive value to stack to the right
            zIndex: visibleCards - index,
            backgroundColor: themeColors[index], // Use colors from the selected theme
            borderColor: 'black',
             borderWidth: '4px'
          }}
        />
      ))}
    </div>
  );
}

export default CueStack;
/**
 * We can mitigate against re-rendering but introducing a flag maxlength = true|false
 * 
 */