// bloom-maps/app/ui/ConceptMap.tsx

'use client';

import React from 'react';
import ConceptNode from './ConceptNode';
import useNodeManager from './hooks/useNodeManager';
import { CueCard } from '@/app/Definitions/Definitions';

function ConceptMap({ setSelectedCueCards }: { setSelectedCueCards: (cards: CueCard[]) => void }) {
  const { nodes, createNewNode, addCueCardToNode, updateNodeTitle } = useNodeManager();

  // Function to handle selecting a concept node and displaying its cue cards
  const handleViewConcept = (cueCards: CueCard[]) => {
    setSelectedCueCards(cueCards); // Update state with the cue cards from the selected concept node
  };

  // Function to create a new child node
  const createNewChildNode = (parentId: string) => {
    const newChildTitle = `Child of ${parentId}`;
    createNewNode(newChildTitle);
  };

  return (
    <div className="relative w-full h-full bg-white overflow-auto">
      {/* Floating button to create a new top-level concept */}


      {/* Render concept nodes */}
      {nodes.map((node) => (
        <ConceptNode
          key={node.id}
          node={node}
          onClick={handleViewConcept} // Pass the function to handle viewing the concept's cue cards
          addCueCardToNode={addCueCardToNode}
          updateNodeTitle={updateNodeTitle}
          createNewChildNode={createNewChildNode}
        />
      ))}
    </div>
  );
}

export default ConceptMap;
