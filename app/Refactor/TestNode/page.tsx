'use client';

import React from 'react';
import ConceptNode from '@/app/Refactor/Component/ConceptNode';
import  DocumentProvider  from '@/app/Refactor/Context/DocumentProvider';
import { ConceptNode as ConceptNodeType } from '@/app/Refactor/Definitions/Definitions';

// Mock data for testing
const mockNode: ConceptNodeType = {
  id: 'node1',
  title: 'Sample Node',
  description: 'A sample description for the node.',
  cueCards: [
    {
      id: 'cueCard1',
      title: 'Sample Cue Card 1',
      content: 'Content of cue card 1.',
      bloomLevel: 1,
    },
    {
      id: 'cueCard2',
      title: 'Sample Cue Card 2',
      content: 'Content of cue card 2.',
      bloomLevel: 2,
    },
  ],
  x: 100,
  y: 100,
  isRoot: true,
};

// Mock handlers
const handleNodeClick = (cueCards: ConceptNodeType['cueCards']) => {
  console.log('Node clicked:', cueCards);
};

const handleDragStart = (node: ConceptNodeType) => {
  console.log('Drag started for node:', node);
};

export default function TestPage() {
  return (
    <DocumentProvider>
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <ConceptNode
          node={mockNode}
          onClick={handleNodeClick}
          onDragStart={handleDragStart}
        />
      </div>
    </DocumentProvider>
  );
}
