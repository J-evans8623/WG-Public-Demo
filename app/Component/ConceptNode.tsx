// bloom-maps/app/Component/ConceptNode.tsx

'use client';

import React, { useState } from 'react';
import CueStack from './CueStack';
import Modal from './Modal';
import { CueCard, ExtendedConceptNodeProps, colorThemes } from '@/app/Definitions/Definitions'; 
import { useDocumentContext } from '@/app/Component/context/DocumentProvider';

// Create a local alias for the type to avoid conflicts
type ConceptNodeType = import('@/app/Definitions/Definitions').ConceptNode;

function ConceptNode({ node, onClick, onDragStart }: ExtendedConceptNodeProps & { onDragStart: (node: ConceptNodeType) => void }) {
  const { addCueCardToNode, updateNodeTitle, createNewNode, selectCueCards, colorTheme } = useDocumentContext();

  const { title, cueCards, x, y } = node;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isAddingCueCard, setIsAddingCueCard] = useState(false);
  const [newTitle, setNewTitle] = useState(title);

  // Initialize newCueCard with a unique ID and bloom level
  const [newCueCard, setNewCueCard] = useState<CueCard>({
    id: Date.now().toString(),
    title: '',
    content: '',
    bloomLevel: 1,
  });

  const handleDragStartLocal = (event: React.DragEvent) => {
    event.dataTransfer.setData('text/plain', node.id);
    onDragStart(node); // Trigger parent drag start
  };

  return (
    <div
      className="relative flex flex-col items-center cursor-pointer group border rounded shadow-md"
      style={{
        width: '200px',
        height: '150px',
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
      }}
      onClick={() => onClick(cueCards)}
      draggable // Enable dragging
      onDragStart={handleDragStartLocal} // Add drag start handler
      title="View Concept"
    >
      {/* Title of the Concept-node */}
      <h2
        onClick={(e) => {
          e.stopPropagation();
          setIsEditingTitle(true);
        }}
        className="mb-1 text-lg font-semibold text-gray-800 group-hover:bg-gray-100 rounded"
        title="Click to edit title"
      >
        {title}
      </h2>

      {/* CueStack visualization with updated onClick */}
      <CueStack
        cueCardCount={cueCards.length}
        colorTheme={colorThemes[colorTheme]}
        onClick={(e) => e.stopPropagation()}
      />

      {/* + Button for adding a new child concept */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          createNewNode(`Child of ${node.id}`);
        }}
        className="absolute bottom-2 left-2 bg-gray-200 text-black rounded px-2 py-1 flex items-center justify-center hover:bg-gray-300 transition-colors duration-200 text-sm group-hover:flex hidden"
        title="Click to add a new child concept"
      >
        +
      </button>

      {/* Modals for editing title and adding cue cards */}
      {/* (Existing modal code remains unchanged) */}
    </div>
  );
}

export default ConceptNode;
