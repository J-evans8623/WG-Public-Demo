// bloom-maps/ui/ConceptNode.tsx
'use client';

import React from 'react';
import CueStack from './CueStack'; // Import the CueStack component
import { ConceptNodeProps } from '@/app/Definitions/Definitions';

function ConceptNode({ node, onClick }: ConceptNodeProps) {
  const { title, cueCards } = node;
  const cueCardCount = cueCards.length;
  const colorTheme = [
    'rgb(223, 252, 173)', // Light green
    'rgb(181, 245, 216)', // Light teal
    'rgb(168, 204, 252)', // Light blue
    'rgb(137, 112, 252)', // Light purple
  ];

  return (
    <div
      onClick={onClick} // Use the onClick prop passed from ConceptMap
      className="flex flex-col items-center cursor-pointer group"
    >
      {/* Title of the Concept-node */}
      <h2 className="mb-1 text-lg font-semibold text-gray-800 group-hover:bg-gray-100 rounded">
        {title}
      </h2>

      {/* CueStack visualization */}
      <CueStack
        cueCardCount={cueCardCount}
        colorTheme={colorTheme}
        className="group-hover:bg-gray-100 rounded"
      />
    </div>
  );
}

export default ConceptNode;
