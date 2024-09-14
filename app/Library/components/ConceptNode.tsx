// bloom-maps/app/Component/ConceptNode.tsx

'use client';

import React, { useState, memo } from 'react';
import CueStack from './CueStack';
import Modal from './Modal';
import { CueCard, colorThemes, ConceptNode as ConceptNodeType, ConceptNodeProps} from '@/app/Library/Definitions/Definitions'; 
import { useNewDocumentContext, updateNodeTitle, setGetLayout, createNewNode} from '@/app/Library/Context/newDocumentProvider';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useCueCardContext } from '@/app/Library/Context/CueCardContext';
import ModernModal from '@/app/Library/components/ModernModal';

function ConceptNode({ node, onDragStart }: ConceptNodeProps) {
  
 // New Document Reducer context
  const { state, dispatch } = useNewDocumentContext(); 
  const { colorTheme } = state;
  const { toggleNodeSelection } = useNodeSelection();
  const { addCueCard } = useCueCardContext();

  const { title, x, y, isRoot } = node;
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
    setIsEditingTitle(true);// add setgetlayout(false)
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
    dispatch(updateNodeTitle(node.id, newTitle)); // Dispatch the action to update the node title
    setIsEditingTitle(false);
  };// setGetlayout(false)

  const handleCueCardSave = (title: string, content: string, bloomLevel: 1 | 2 | 3 | 4 | 5 | 6) => {
    const newCard: CueCard = {
      id: Date.now().toString(),
      title,
      content,
      bloomLevel,
    };
    addCueCard(node.id, newCard); // Update cue-card map without re-rendering ConceptNode
    setIsAddingCueCard(false);
  };

  const handleAddChildNode = () => {
    const newChildTitle = `Child of ${node.id}`;
    dispatch(createNewNode(newChildTitle, node.id)); // Dispatch action with title and parent node ID
    dispatch(setGetLayout(true)); // Dispatch action to update layout flag
  };

/**  const handleNodeClick = () => {
    onClick(cueCards);
    dispatch(selectCueCards(node.cueCards));
    
  }; */
  {/** More drag logic for concept node  **/}
  // Handle drag start with visual feedback
  const handleDragStartLocal = (event: React.DragEvent) => {
    event.dataTransfer.setData('text/plain', node.id);
    onDragStart(node); 
    setIsDragging(true); // is this functional???
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
      onClick={() => toggleNodeSelection(node.id)} // Toggle node selection on click
      title="View Concept"
      draggable
      onDragStart={handleDragStartLocal}
      onDragEnd={handleDragEnd} 
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
        nodeId={node.id} // Pass the nodeId to the CueStack
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
<ModernModal
  isOpen={isAddingCueCard}
  onClose={() => setIsAddingCueCard(false)}
  onCreateCueCard={handleCueCardSave} // Function to save the cue card
>
  {/* Content of ModernModal will be handled internally */}
</ModernModal>

    </div>
  );
}

// Use a custom comparison function to check if props have actually changed
export default memo(ConceptNode, (prevProps, nextProps) => {
  // Only re-render if relevant props change
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.title === nextProps.node.title &&
    prevProps.node.x === nextProps.node.x &&
    prevProps.node.y === nextProps.node.y &&
    prevProps.node.isRoot === nextProps.node.isRoot
  );
});