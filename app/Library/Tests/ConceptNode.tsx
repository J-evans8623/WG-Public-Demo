//bloom-maps\app\Library\Tests\ConceptNode.tsx
'use client';

import React, { useState, memo, useCallback } from 'react';
import { CueCard, ConceptNode as ConceptNodeType, ConceptNodeProps } from '@/app/Library/Definitions/Definitions'; 
import { useDocumentContext, updateNodeTitle, setGetLayout, createNewNode } from '@/app/Library/Context/DocumentProvider';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';



// Arbitrary default colors
const DEFAULT_PRIMARY_COLOR = '#D5E6ED'; // Arbitrary default primary color
const DEFAULT_BACKGROUND_COLOR = '#ECE7D1'; // Arbitrary default background color

function ConceptNode({
     node, 
     onOpenCueCardModal, 
     onOpenAddChildModal }:  ConceptNodeProps & { onOpenAddChildModal: (parentNodeId: string) => void })  {
  
  const { state } = useDocumentContext(); 
  const { colorTheme, primaryColor = DEFAULT_PRIMARY_COLOR, backgroundColor = DEFAULT_BACKGROUND_COLOR } = state;
  const { toggleNodeSelection } = useNodeSelection();

  const { title, x, y, depth } = node;

  // Handle node click
  const handleNodeClick = useCallback(() => {
    toggleNodeSelection(node.id); // Execute the single-click action
  }, [node.id, toggleNodeSelection]);


  // Handle adding a child node
  const handleAddChildNode = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenAddChildModal(node.id);
  };

  // Determine the color based on the depth of the node
  const nodeColor = depth === 1 ? primaryColor : backgroundColor;

  return (
    <>
      <div
        className="relative flex flex-col items-center cursor-pointer group border rounded-md shadow-md"
        style={{
          width: '325px',
          height: '125px',
          position: 'absolute',
          left: `${x}px`,
          top: `${y}px`,
          borderColor: 'white',
          backgroundColor: nodeColor,
        }}
        onClick={handleNodeClick}
        title="View Concept"
      >
        {/* Title of the Concept-node */}
        <h2 className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-gray-800 rounded">
          {title}
        </h2>

      {/* Add Child Node Button */}
      <button
        onClick={handleAddChildNode}
        className="absolute bottom-2 right-2 text-black rounded-full w-6 h-6 flex items-center justify-center transition-colors duration-200"
        title="Add Child Concept"
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

        {/* Add Cue Card Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenCueCardModal(node.id);
          }}
          className="absolute bottom-2 right-10 text-black rounded-full w-6 h-6 flex items-center justify-center transition-colors duration-200"
          title="Add Cue Card"
        >
          {/* Icon: Stacked Cards */}
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Cards */}
            <div
              className="absolute w-2/3 h-2/3 border border-black transform -translate-x-1 -translate-y-1"
              style={{ backgroundColor: nodeColor }}
            />
            <div
              className="absolute w-2/3 h-2/3 border border-black transform -translate-x-0.5 -translate-y-0.5"
              style={{ backgroundColor: nodeColor }}
            />
            <div
              className="absolute w-2/3 h-2/3 border border-black"
              style={{ backgroundColor: nodeColor }}
            />
            <span className="absolute text-xs font-bold">+</span>
          </div>
        </button>
      </div>
    </>
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
