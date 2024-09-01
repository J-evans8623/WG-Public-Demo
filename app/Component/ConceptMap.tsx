// bloom-maps/app/ui/ConceptMap.tsx

'use client';

import React from 'react';
import ConceptNode from './ConceptNode';
import { useDocumentContext } from '@/app/Component/context/DocumentProvider'; // Updated import path if necessary
import { CueCard } from '@/app/Definitions/Definitions';

function ConceptMap({ setSelectedCueCards }: { setSelectedCueCards: (cards: CueCard[]) => void }) {
  // Destructure the updated context to get all necessary functions and state
  const {
    nodes,
    selectCueCards,
  } = useDocumentContext(); // Access only the necessary context

  // Function to handle selecting a concept node and displaying its cue cards
  const handleViewConcept = (cueCards: CueCard[]) => {
    setSelectedCueCards(cueCards); // Update state with the cue cards from the selected concept node
    selectCueCards(cueCards); // Ensure selected cue cards are updated in the global context
  };

  return (
    <div className="relative w-full h-full bg-white overflow-auto">
      {/* Render concept nodes */}
      {nodes.map((node) => (
        <ConceptNode
          key={node.id}
          node={node}
          onClick={handleViewConcept}
        />
      ))}
    </div>
  );
}

export default ConceptMap;
