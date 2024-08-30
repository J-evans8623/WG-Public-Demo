// bloom-maps/app/ui/ConceptNodeTest.tsx
'use client'; // Ensure this is a client component

import React from 'react';
import ConceptNode from '@/app/ui/ConceptNode'; // Import the ConceptNode component

// Mock data for testing the ConceptNode component
const mockNode = {
  id: '1',
  title: 'Sample Concept',
  description: 'A brief description of this concept',
  cueCards: [
    { id: '1', title: 'Cue 1', content: 'Content of Cue 1' },
    { id: '2', title: 'Cue 2', content: 'Content of Cue 2' },
    { id: '3', title: 'Cue 3', content: 'Content of Cue 3' },
  ],
};

function ConceptNodeTest() {
  return (
    <div className="p-4">
      <ConceptNode node={mockNode} onClick={() => console.log('test')} />
    </div>
  );
}

export default ConceptNodeTest;
