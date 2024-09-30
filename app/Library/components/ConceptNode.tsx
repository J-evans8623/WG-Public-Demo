// bloom-maps/app/Library/components/ConceptNode.tsx

import React, { memo, useCallback } from 'react';
import { ConceptNodeProps } from '@/app/Library/Definitions/Definitions';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';

const DEFAULT_PRIMARY_COLOR = '#D5E6ED';
const DEFAULT_BACKGROUND_COLOR = '#ECE7D1';

function ConceptNode({
  node,
  onOpenCueCardModal,
  onOpenAddChildModal,
}: ConceptNodeProps & { onOpenAddChildModal: (parentNodeId: string) => void }) {
  const { state } = useDocumentContext();
  const {
    primaryColor = DEFAULT_PRIMARY_COLOR,
    backgroundColor = DEFAULT_BACKGROUND_COLOR,
  } = state;
  const { toggleNodeSelection, isSelected } = useNodeSelection();

  const { title, x, y, depth } = node;
  const selected = isSelected(node.id);

  const handleNodeClick = useCallback(() => {
    toggleNodeSelection(node.id);
  }, [node.id, toggleNodeSelection]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleNodeClick();
    }
  };

  const handleAddChildNode = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenAddChildModal(node.id);
  };

  const nodeColor = depth === 1 ? primaryColor : backgroundColor;

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
      }}
      onClick={handleNodeClick}
      onKeyDown={handleKeyDown}
      title="View Concept"
      aria-pressed={selected}
      role="button"
      tabIndex={0}
    >
      {/* Animated Dashed Ring */}
      {selected && (
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
            stroke="#3B82F6"
            strokeWidth="8"
            strokeDasharray="10 10"
            className="animate-dash"
          />
        </svg>
      )}

      {/* Title of the Concept Node */}
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
            style={{ backgroundColor: nodeColor }}
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
            style={{ top: '-4px' }}
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
