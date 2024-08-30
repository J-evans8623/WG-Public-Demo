'use client';
// bloom-maps/ui/ConceptMap.tsx
import React, { useState } from 'react';
import ConceptNode from './ConceptNode'; // Import ConceptNode component
import CueCardDisplay from './CueCardDisplay'; // Import CueCardDisplay component
import { ConceptNode as ConceptNodeType, CueCard } from '@/app/Definitions/Definitions'; // Import interfaces

// Example mock data for ConceptNodes
const conceptNodes: ConceptNodeType[] = [
  {
    id: '1',
    title: 'Concept 1',
    cueCards: [
      { id: '1-1', title: 'Cue 1', content: 'This is the content of Cue 1.' },
      { id: '1-2', title: 'Cue 2', content: 'This is the content of Cue 2.' },
    ],
  },
  // Add more ConceptNodes as needed
];

function ConceptMap() {
  // State to store the currently selected concept node's cue cards
  const [selectedCueCards, setSelectedCueCards] = useState<CueCard[]>([]); // Correctly type the state

  // Function to handle clicking on a ConceptNode
  const handleConceptNodeClick = (cueCards: CueCard[]) => { // Correctly type the parameter
    setSelectedCueCards(cueCards); // Update the state with the selected cue cards
  };

  return (
    <div className="flex">
      {/* Left Panel (Display Plane) */}
      <div className="bg-gray-800 p-4 shadow-lg rounded-lg overflow-y-auto min-w-[200px] flex flex-col space-y-2">
        <CueCardDisplay cueCards={selectedCueCards} />
      </div>

      {/* Concept Nodes Area */}
      <div className="flex flex-wrap p-4">
        {conceptNodes.map((node) => (
          <ConceptNode
            key={node.id}
            node={node}
            onClick={() => handleConceptNodeClick(node.cueCards)}
          />
        ))}
      </div>
    </div>
  );
}

export default ConceptMap;
