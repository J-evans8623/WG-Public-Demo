// bloom-maps/app/ui/ConceptMap.tsx

'use client';

import React, { useEffect } from 'react';
import ConceptNode from './ConceptNode';
import useNodeManager from './hooks/useNodeManager';
import { CueCard } from '@/app/Definitions/Definitions';

function ConceptMap({ setSelectedCueCards, reset }: { setSelectedCueCards: (cards: CueCard[]) => void; reset?: boolean }) {
  const { nodes, createNewNode, addCueCardToNode, updateNodeTitle, resetNodes } = useNodeManager();

  // Function to handle selecting a concept node and displaying its cue cards
  const handleViewConcept = (cueCards: CueCard[]) => {
    setSelectedCueCards(cueCards); // Update state with the cue cards from the selected concept node
  };

  // Function to create a new child node
  const createNewChildNode = (parentId: string) => {
    const newChildTitle = `Child of ${parentId}`;
    createNewNode(newChildTitle);
  };

  // Use useEffect to reset nodes when reset prop is true
  useEffect(() => {
    if (reset) {
      resetNodes(); // Call the reset function to clear all nodes and create a new root node
    }
  }, [reset]);

  return (
    <div className="relative w-full h-full bg-white overflow-auto">
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
