// ConceptNode.tsx

import React, { memo, useCallback } from 'react';
import { ConceptNode as NodeType } from '@/app/Library/Definitions/Definitions';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import AddConceptIcon from '@/app/icons-custom/ConceptNodeAdd.svg';
import { useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import './ConceptNode.css';

// Define color constants for different node states
const GENERAL_SELECTED_COLOR = '#3B82F6'; // Blue
const CARET_COLOR = '#FF6500'; // Amber-Orange
const TARGET_COLOR = '#28A745'; // Lime Green
const OUTLINE_COLOR = '#6e6e6e'; // Solid Outline Color

interface ConceptNodeProps {
  node: NodeType;
  openModalWithResourceType: (
    nodeId: string | null,
    resourceType: 'cueCard' | 'picture' | 'practiceSheet' | undefined,
    op: 'resource' | 'node'
  ) => void;
  onNodeClick: (nodeId: string) => void;
}

function ConceptNode({
  node,
  openModalWithResourceType, // Use the interface-defined prop
  onNodeClick,
}: ConceptNodeProps) {
  const { primaryColor, backgroundColor } = useColorThemeContext();
  const {
    isSelected,
    targetNodeId,
    getFocusNode,
  } = useNodeSelection(); // Destructure necessary functions

  const focusNodeId = getFocusNode();
  const currentTargetNodeId = targetNodeId;

  const { title, x, y, depth } = node;

  const handleNodeClick = useCallback(() => {
    onNodeClick(node.id);
  }, [node.id, onNodeClick]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleNodeClick();
      }
    },
    [handleNodeClick]
  );

  const handleAddChildNode = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      openModalWithResourceType(node.id, undefined, 'node'); // Open as addChild
    },
    [node.id, openModalWithResourceType]
  );

  const handleOpenGeneralModal = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      openModalWithResourceType(node.id, undefined, 'resource'); // Open General Modal
    },
    [node.id, openModalWithResourceType]
  );

  const nodeColor = depth === 1 ? primaryColor : backgroundColor;

  // Determine the node's selection state
  const selected = isSelected(node.id) || node.id === currentTargetNodeId;

  // Determine if the node is the focus node (caret) or target node
  const isCaretNode = node.id === focusNodeId;
  const isTargetNode = node.id === currentTargetNodeId && node.id !== focusNodeId;

  // Determine the ring color based on node type
  let ringColor: string | null = null;
  if (isCaretNode) {
    ringColor = CARET_COLOR;
  } else if (isTargetNode) {
    ringColor = TARGET_COLOR;
  } else if (selected) {
    ringColor = GENERAL_SELECTED_COLOR;
  }

  // Determine container classes with conditional styling
  const containerClasses = `relative flex flex-col items-center cursor-pointer group rounded-md shadow-md transition-all duration-200 ${
    selected ? 'bg-blue-50 shadow-lg' : 'bg-white shadow-md'
  }`;

  return (
    <div
      className={containerClasses}
      style={{
        width: '325px',
        height: '125px',
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        backgroundColor: nodeColor,
        zIndex: selected ? 10 : 1,
        // Apply solid outline when not selected
        border: selected ? 'none' : `5px solid ${OUTLINE_COLOR}`,
        boxSizing: 'border-box', // Ensure border does not affect size
        transition: 'none',
      }}
      onClick={handleNodeClick}
      onKeyDown={handleKeyDown}
      title="View Concept"
      aria-pressed={selected}
      role="button"
      tabIndex={0}
    >
      {selected && ringColor && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 325 125"
          preserveAspectRatio="none"
          style={{ zIndex: -1 }}
        >
          <rect
            x="0"
            y="0"
            width="325"
            height="125"
            fill="none"
            stroke={ringColor}
            strokeWidth="8"
            strokeDasharray="10 10"
            className="animate-dash"
          />
        </svg>
      )}

      <div className="TitleContainer">
        <p className="multiline nodeTitle" title={title}>
          {title}
        </p>
      </div>

      <button
        onClick={handleAddChildNode}
        className="absolute bottom-2 right-2 text-black rounded-full flex items-center justify-center transition-colors duration-200"
        title="Add Supporting Concept"
        style={{
          width: '28px',
          height: '28px',
          padding: '2px',
        }}
      >
        <AddConceptIcon className="w-full h-full" />
      </button>

      <button
        onClick={handleOpenGeneralModal}
        className="absolute bottom-2 right-10 text-black rounded-full w-6 h-6 flex items-center justify-center transition-colors duration-200"
        title="Add Study Resource"
      >
        <div className="relative w-full h-full flex items-center justify-center">
          <div
            className="absolute w-2/3 h-2/3 border border-black transform -translate-x-1 -translate-y-1"
            style={{ backgroundColor: nodeColor }}
          />
          <div
            className="absolute w-2/3 h-2/3 border border-black transform -translate-x-0.5 -translate-y-0.5"
            style={{ backgroundColor: nodeColor }}
          />
          <div className="absolute w-2/3 h-2/3 border border-black" style={{ backgroundColor: nodeColor }} />
          <span className="absolute text-xs font-bold">+</span>
        </div>
      </button>
    </div>
  );
}

ConceptNode.displayName = 'ConceptNode';

export default memo(
  ConceptNode,
  (prevProps, nextProps) =>
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.title === nextProps.node.title &&
    prevProps.node.x === nextProps.node.x &&
    prevProps.node.y === nextProps.node.y &&
    prevProps.node.isRoot === nextProps.node.isRoot &&
    prevProps.onNodeClick === nextProps.onNodeClick
);
