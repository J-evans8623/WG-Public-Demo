// bloom-maps/ui/ConceptNode.tsx

'use client';

import React, { useState } from 'react';
import CueStack from './CueStack';
import Modal from './Modal';
import { CueCard, ExtendedConceptNodeProps } from '@/app/Definitions/Definitions';
import { useDocumentContext,  } from '@/app/Component/context/DocumentProvider'; 



function ConceptNode({ node, onClick }: ExtendedConceptNodeProps) {
  const {
    addCueCardToNode,
    updateNodeTitle,
    createNewNode,
    selectCueCards,
  } = useDocumentContext(); // Use updated context hooks

  const { title, cueCards } = node;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isAddingCueCard, setIsAddingCueCard] = useState(false);
  const [newTitle, setNewTitle] = useState(title);

  // Initialize newCueCard with a unique ID
  const [newCueCard, setNewCueCard] = useState<CueCard>({
    id: Date.now().toString(),
    title: '',
    content: '',
  });

  const handleTitleClick = () => {
    setIsEditingTitle(true);
  };

  const handleCueStackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setNewCueCard({
      id: Date.now().toString(),
      title: '',
      content: '',
    });
    setIsAddingCueCard(true);
  };

  const handleTitleSave = () => {
    updateNodeTitle(node.id, newTitle);
    setIsEditingTitle(false);
  };

  const handleCueCardSave = () => {
    addCueCardToNode(node.id, newCueCard);
    setIsAddingCueCard(false);
    setNewCueCard({
      id: Date.now().toString(),
      title: '',
      content: '',
    });
  };

  const handleAddChildNode = () => {
    const newChildTitle = `Child of ${node.id}`;
    createNewNode(newChildTitle);
  };

  const handleNodeClick = () => {
    onClick(cueCards);
    selectCueCards(cueCards); // Sync selected cue cards with global state
  };

  return (
    <div
      className="relative flex flex-col items-center cursor-pointer group border rounded shadow-md"
      style={{ width: '200px', height: '150px' }}
      onClick={handleNodeClick} // Updated to handle both local and global cue card selection
      title="View Concept"
    >
      {/* Title of the Concept-node */}
      <h2
        onClick={(e) => {
          e.stopPropagation();
          handleTitleClick();
        }}
        className="mb-1 text-lg font-semibold text-gray-800 group-hover:bg-gray-100 rounded"
        title="Click to edit title"
      >
        {title}
      </h2>

      {/* CueStack visualization with updated onClick */}
      <CueStack
        cueCardCount={cueCards.length}
        colorTheme={['rgb(223, 252, 173)', 'rgb(181, 245, 216)', 'rgb(168, 204, 252)', 'rgb(137, 112, 252)']}
        onClick={handleCueStackClick}
      />

      {/* + Button for adding a new child concept */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleAddChildNode();
        }}
        className="absolute bottom-2 left-2 bg-gray-200 text-black rounded px-2 py-1 flex items-center justify-center hover:bg-gray-300 transition-colors duration-200 text-sm group-hover:flex hidden"
        title="Click to add a new child concept"
      >
        +
      </button>

      {/* Modal for Editing Title */}
      <Modal isOpen={isEditingTitle} onClose={() => setIsEditingTitle(false)}>
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="border p-2 w-full"
        />
        <button onClick={handleTitleSave} className="mt-2 bg-green-500 text-white px-4 py-2 rounded">
          Save Title
        </button>
      </Modal>

      {/* Modal for Adding Cue Card */}
      <Modal isOpen={isAddingCueCard} onClose={() => setIsAddingCueCard(false)}>
        <input
          type="text"
          value={newCueCard.title}
          onChange={(e) => setNewCueCard({ ...newCueCard, title: e.target.value })}
          placeholder="Cue Card Title"
          className="border p-2 w-full"
        />
        <textarea
          value={newCueCard.content}
          onChange={(e) => setNewCueCard({ ...newCueCard, content: e.target.value })}
          placeholder="Cue Card Content"
          className="border p-2 w-full mt-2"
        />
        <button onClick={handleCueCardSave} className="mt-2 bg-green-500 text-white px-4 py-2 rounded">
          Save Cue Card
        </button>
      </Modal>
    </div>
  );
}

export default ConceptNode;
