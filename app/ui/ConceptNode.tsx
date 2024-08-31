// bloom-maps/ui/ConceptNode.tsx

'use client';

import React, { useState } from 'react';
import CueStack from './CueStack';
import Modal from './Modal';
import { ConceptNodeProps, CueCard } from '@/app/Definitions/Definitions';

interface ExtendedConceptNodeProps extends ConceptNodeProps {
  addCueCardToNode: (nodeId: string, cueCard: CueCard) => void;
  updateNodeTitle: (nodeId: string, newTitle: string) => void;
  createNewChildNode: (parentId: string) => void; // New prop to handle child node creation
}

function ConceptNode({ node, onClick, addCueCardToNode, updateNodeTitle, createNewChildNode }: ExtendedConceptNodeProps) {
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

  const handleCueStackClick = () => {
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

  // Handle adding a new child node
  const handleAddChildNode = () => {
    createNewChildNode(node.id); // Call the function to create a new child node
  };

  return (
    <div
      className="relative flex flex-col items-center cursor-pointer group border rounded shadow-md"
      style={{ width: '200px', height: '150px' }} // Set appropriate dimensions here
    >
      {/* Title of the Concept-node */}
      <h2
        onClick={handleTitleClick}
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

      {/* + Add New Child Node Button at Bottom Left */}
      <button
        onClick={handleAddChildNode}
        className="absolute bottom-2 left-2 bg-blue-500 text-white rounded-full p-1 flex items-center justify-center shadow hover:bg-blue-600 transition-colors duration-200"
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
