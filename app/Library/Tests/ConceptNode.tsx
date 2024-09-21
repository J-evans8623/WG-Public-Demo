'use client';

import React, { useState, memo, useCallback } from 'react';
import Modal from '../components/Modal';
import { CueCard, colorThemes, ConceptNode as ConceptNodeType, ConceptNodeProps } from '@/app/Library/Definitions/Definitions'; 
import { useDocumentContext, updateNodeTitle, setGetLayout, createNewNode } from '@/app/Library/Context/DocumentProvider';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useCueCardContext } from '@/app/Library/Context/CueCardContext';

// Arbitrary default colors
const DEFAULT_PRIMARY_COLOR = '#D5E6ED'; // Arbitrary default primary color
const DEFAULT_BACKGROUND_COLOR = '#ECE7D1'; // Arbitrary default background color

function ConceptNode({ node, onOpenCueCardModal }: ConceptNodeProps) {
  
  const { state, dispatch } = useDocumentContext(); 
  const { colorTheme, primaryColor = DEFAULT_PRIMARY_COLOR, backgroundColor = DEFAULT_BACKGROUND_COLOR } = state;
  const { toggleNodeSelection } = useNodeSelection();
  const { addCueCard } = useCueCardContext();

  const { title, x, y, isRoot, depth } = node;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isAddingCueCard, setIsAddingCueCard] = useState(false);
  const [newTitle, setNewTitle] = useState(title);
  const [isDragging, setIsDragging] = useState(false);

  // State for new cue card
  const [newCueCard, setNewCueCard] = useState<CueCard>({
    id: Date.now().toString(),
    title: '',
    content: '',
    bloomLevel: 1, 
  });

  // Handle title click with Ctrl/Cmd
  const handleTitleClick = useCallback((e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) { // Ctrl for Windows, Meta (Cmd) for macOS
      e.stopPropagation();
      setIsEditingTitle(true);
    }
  }, []);

  // Handle node click
  const handleNodeClick = useCallback(() => {
    toggleNodeSelection(node.id); // Execute the single-click action
  }, [node.id, toggleNodeSelection]);

  const handleAddCueCardClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onOpenCueCardModal(node.id); // Call the custom modal handler passed as a prop
  };

  const handleCueCardSave = () => {
    addCueCard(node.id, newCueCard); // Add the cue card to the node
    setIsAddingCueCard(false); // Close the modal
    setNewCueCard({
      id: Date.now().toString(),
      title: '',
      content: '',
      bloomLevel: 1,
    }); // Reset the cue card state
  };

  const handleTitleSave = () => {
    dispatch(updateNodeTitle(node.id, newTitle));
    setIsEditingTitle(false);
  };

  const handleAddChildNode = () => {
    const newChildTitle = `Child of ${node.id}`;
    dispatch(createNewNode(newChildTitle, node.id));
    dispatch(setGetLayout(true));
  };

  // Determine the color based on the depth of the node
  const nodeColor = depth === 1 ? primaryColor : backgroundColor;

  return (
    <div
      className={`relative flex flex-col items-center cursor-pointer group border rounded-md shadow-md ${
        isDragging ? 'opacity-50 border-dashed border-2 border-blue-500' : ''
      }`}
      // Width : Height -> 2.6 : 1
      style={{
        width: '325px', // min horizontal space is 600px at a width of 325 roughly 2x
        height: '125px', // min vertical offset is 225 at a height of 125 roughly 2x
        position: 'absolute', //isRoot ? 'relative' : 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        borderColor: 'white',
        backgroundColor: nodeColor,
      }}
      onClick={handleNodeClick} // Handle single click for node selection
      title="View Concept"
      draggable
      //onDragStart={handleDragStartLocal}
      //onDragEnd={handleDragEnd} 
    >
      {/* Title of the Concept-node, now centered */}
      <h2
        onClick={handleTitleClick} // Use Ctrl/Cmd + Click to edit title
        className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-gray-800 rounded"
        title="Edit title (Ctrl/Cmd + Click)"
      >
        {title}
      </h2>

      {/* Updated Add Concept Node Button with New Design */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleAddChildNode();
        }}
        className="absolute bottom-2 right-2 text-black rounded-full w-6 h-6 flex items-center justify-center transition-colors duration-200"
        title="Click to add a new child concept"
      >
        {/* Icon: Single white card with an arrow */}
        <div className="relative w-full h-full flex items-center justify-center">
  {/* Card */}
  <div
    className="absolute w-2/3 h-2/3 border border-black"
    style={{ backgroundColor: nodeColor }} // Set the card background color to match the concept node
  />

  {/* Plus Sign */}
  <span className="absolute text-xs font-bold">+</span>

  {/* Downward Arrow */}
  <svg
    className="absolute"
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="black"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ top: '-4px' }} // Adjust the arrow position
  >
    <path d="M12 2v14M5 10l7 7 7-7" />
  </svg>
</div>

      </button>

      {/* Add Cue Card Button with Stacked Card Icon */}
      <button
        onClick={handleAddCueCardClick}
        className="absolute bottom-2 right-10 text-black rounded-full w-6 h-6 flex items-center justify-center transition-colors duration-200"
        title="Click to add a new cue card"
      >
        {/* Three stacked cards with a plus sign */}
        <div className="relative w-full h-full flex items-center justify-center">
  {/* Card 1 */}
  <div
    className="absolute w-2/3 h-2/3 border border-black transform -translate-x-1 -translate-y-1"
    style={{ backgroundColor: nodeColor }} // Set the card background color to match the concept node
  />

  {/* Card 2 */}
  <div
    className="absolute w-2/3 h-2/3 border border-black transform -translate-x-0.5 -translate-y-0.5"
    style={{ backgroundColor: nodeColor }} // Set the card background color to match the concept node
  />

  {/* Card 3 */}
  <div
    className="absolute w-2/3 h-2/3 border border-black"
    style={{ backgroundColor: nodeColor }} // Set the card background color to match the concept node
  />
          <span className="absolute text-xs font-bold">+</span>
        </div>
      </button>

      {/* Modal for Editing Title */}
      <Modal isOpen={isEditingTitle} onClose={() => setIsEditingTitle(false)}>
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="border p-2 w-full"
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleTitleSave();
          }}
          className="mt-2 bg-green-500 text-white px-4 py-2 rounded"
        >
          Save Title
        </button>
      </Modal>
    </div>
  );
}

export default memo(ConceptNode, (prevProps, nextProps) => {
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.title === nextProps.node.title &&
    prevProps.node.x === nextProps.node.x &&
    prevProps.node.y === nextProps.node.y &&
    prevProps.node.isRoot === nextProps.node.isRoot
  );
});
