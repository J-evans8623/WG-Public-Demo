// bloom-maps/app/ui/ConceptMap.tsx

'use client';

import React from 'react';
import ConceptNode from './ConceptNode';
import useNodeManager from './hooks/useNodeManager';

function ConceptMap() {
  const { nodes, createNewNode, addCueCardToNode, updateNodeTitle } = useNodeManager();

  // Function to create a new child node
  const createNewChildNode = (parentId: string) => {
    const newChildTitle = `Child of ${parentId}`; // Default title, or open a prompt to get user input
    createNewNode(newChildTitle);
  };

  return (
    <div className="relative w-full h-full bg-white overflow-auto">

      {nodes.map((node) => (
        <ConceptNode
          key={node.id}
          node={node}
          onClick={() => console.log(`Clicked on ${node.title}`)}
          addCueCardToNode={addCueCardToNode}
          updateNodeTitle={updateNodeTitle}
          createNewChildNode={createNewChildNode} // Pass the new function
        />
      ))}
    </div>
  );
} export default ConceptMap;
