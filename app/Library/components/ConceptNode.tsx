// bloom-maps/app/Component/ConceptNode.tsx

'use client';

import React, { useState } from 'react';
import CueStack from './CueStack';
import Modal from './Modal';
import { CueCard, ExtendedConceptNodeProps, colorThemes, ConceptNode as ConceptNodeType, } from '@/app/Library/Definitions/Definitions'; 
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';
import { useNewDocumentContext, addCueCardToNode, updateNodeTitle, setGetLayout, createNewNode } from '@/app/Library/Context/newDocumentProvider';

function ConceptNode({ node, onClick, onDragStart }: ExtendedConceptNodeProps & { onDragStart: (node: ConceptNodeType) => void }) {
  
  const {
    addCueCardToNode,
    updateNodeTitle,
    selectCueCards,// not complete
    //colorTheme,
    setGetLayout, 
  } = useDocumentContext();

  //const { createNewNode }: { createNewNode: (title: string, parentNodeId: string) => void } = useDocumentContext();

  // New Document Reducer context
  const { state, dispatch } = useNewDocumentContext(); 
  const { colorTheme } = state;

  const { title, cueCards, x, y, isRoot } = node;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isAddingCueCard, setIsAddingCueCard] = useState(false);
  const [newTitle, setNewTitle] = useState(title);
  const [isDragging, setIsDragging] = useState(false); // State for drag feedback

  // Initialize newCueCard with a unique ID and bloom level
  const [newCueCard, setNewCueCard] = useState<CueCard>({
    id: Date.now().toString(),
    title: '',
    content: '',
    bloomLevel: 1, 
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
      bloomLevel: 1, 
    });
    setIsAddingCueCard(true);
  };

  const handleTitleSave = () => {
    updateNodeTitle(node.id, newTitle);
    setIsEditingTitle(false);
  };

  const handleCueCardSave = (title: string, content: string, bloomLevel: 1 | 2 | 3 | 4 | 5 | 6) => {
    const newCard: CueCard = {
      id: Date.now().toString(),
      title,
      content,
      bloomLevel,
    };
    addCueCardToNode(node.id, newCard);
    setIsAddingCueCard(false);
  };

  /**const handleAddChildNode = () => {
    const newChildTitle = `Child of ${node.id}`;
    createNewNode(newChildTitle, node.id); // Pass the current node ID as parent ID
    setGetLayout(true);
  };*/
  const handleAddChildNode = () => {
    const newChildTitle = `Child of ${node.id}`;
    dispatch(createNewNode(newChildTitle, node.id)); // Dispatch action with title and parent node ID
    dispatch(setGetLayout(true)); // Dispatch action to update layout flag
  };

  const handleNodeClick = () => {
    dispatch(selectCueCards(node.cueCards));
    onClick(cueCards);
    
  };
  {/** More drag logic for concept node  **/}
  // Handle drag start with visual feedback
  const handleDragStartLocal = (event: React.DragEvent) => {
    event.dataTransfer.setData('text/plain', node.id);
    onDragStart(node); 
    setIsDragging(true); 
  };

  // Handle drag end to reset visual feedback
  const handleDragEnd = () => {
    setIsDragging(false); 
  };
  {/** End of dragging logic  **/}
  return (
    <div
      className={`relative flex flex-col items-center cursor-pointer group border rounded-md shadow-md ${
        isDragging ? 'opacity-50 border-dashed border-2 border-blue-500' : ''
      }`}
      style={{
        width: '200px',
        height: '150px',
        position: isRoot ? 'relative' : 'absolute', // Use the isRoot field for positioning
        left: `${x}px`,
        top: `${y}px`,
        borderColor: colorThemes[colorTheme][5]
      }}
      onClick={handleNodeClick} 
      draggable
      onDragStart={handleDragStartLocal}
      onDragEnd={handleDragEnd} 
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
        colorTheme={colorThemes[colorTheme]} 
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
      <Modal
        isOpen={isAddingCueCard}
        onClose={() => setIsAddingCueCard(false)}
        onCreateCueCard={handleCueCardSave} 
      >
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
        {/* Bloom Level Radio Buttons */}
        <p>Select Bloom Level:</p>
        <div className="mt-4">
          {[1, 2, 3, 4, 5, 6].map((level) => (
            <label key={level} className="flex items-center space-x-2 mb-2">
              <input
                type="radio"
                name="bloomLevel"
                value={level}
                checked={newCueCard.bloomLevel === level}
                onChange={() => setNewCueCard({ ...newCueCard, bloomLevel: level as 1 | 2 | 3 | 4 | 5 | 6 })}
                className="form-radio text-blue-600"
              />
              <span>Bloom Level {level}</span>
            </label>
          ))}
        </div>
        <button onClick={() => handleCueCardSave(newCueCard.title, newCueCard.content, newCueCard.bloomLevel!)} className="mt-2 bg-green-500 text-white px-4 py-2 rounded">
          Save Cue Card
        </button>
      </Modal>
    </div>
  );
}

export default ConceptNode;
