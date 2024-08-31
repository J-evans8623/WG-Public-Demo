// bloom-maps/app/ui/__tests__/ConceptMapTest.tsx
'use client';

import React, { useState } from 'react';
import ConceptMap from '../ConceptMap'; // Import the ConceptMap component
import { ConceptNode as ConceptNodeType } from '@/app/Definitions/Definitions';

// Mock data to test node creation
const mockNodes: ConceptNodeType[] = [
  {
    id: 'node-1',
    title: 'Mock Node 1',
    cueCards: [
      { id: '1', title: 'Cue 1', content: 'Content of Cue 1' },
      { id: '2', title: 'Cue 2', content: 'Content of Cue 2' },
    ],
    parentNodeId: undefined,
    childrenNodeIds: [],
  },
];

function ConceptMapTest() {
  const [nodes, setNodes] = useState<ConceptNodeType[]>(mockNodes);

  const handleAddNode = () => {
    const newNode: ConceptNodeType = {
      id: `node-${nodes.length + 1}`,
      title: `Mock Node ${nodes.length + 1}`,
      cueCards: [],
      parentNodeId: undefined,
      childrenNodeIds: [],
    };
    setNodes([...nodes, newNode]);
  };

  return (
    <div className="flex justify-center items-center p-4 h-full w-full">
      {/* Test the ConceptMap with the mock data */}
      <ConceptMap />
    </div>
  );
}

export default ConceptMapTest;
