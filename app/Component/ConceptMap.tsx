// bloom-maps/app/ui/ConceptMap.tsx

'use client';

import React from 'react';
import ConceptNode from './ConceptNode';
import { useDocumentContext } from '../Component/context/DocumentProvider'; // Use the correct import statement
import { CueCard } from '@/app/Definitions/Definitions';

function ConceptMap() {
  // Destructure the updated context to get all necessary functions and state
  const { nodes, selectCueCards } = useDocumentContext(); // Access context directly

  // Function to handle selecting a concept node and displaying its cue cards
  const handleViewConcept = (cueCards: CueCard[]) => {
    selectCueCards(cueCards); // Update the global context state for selected cue cards
  };

  return (
    <div className="relative w-full h-full bg-white overflow-auto">
      {/* Render concept nodes */}
      {nodes.map((node) => (
        <ConceptNode
          key={node.id}
          node={node}
          onClick={handleViewConcept} // Pass the function to handle viewing the concept's cue cards
        />
      ))}
    </div>
  );
}

export default ConceptMap;
