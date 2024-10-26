// bloom-maps\app\Library\components\ConceptNode.tsx
import React, { memo, useCallback } from 'react';
import { ConceptNodeProps } from '@/app/Library/Definitions/Definitions';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import AddConceptIcon from '@/app/icons-custom/ConceptNodeAdd.svg';

// Import the new context
import { useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';

const DEFAULT_PRIMARY_COLOR = '#F7CAAB';
const DEFAULT_BACKGROUND_COLOR = '#F7EBD1';

function ConceptNode({
  node,
  onOpenCueCardModal,
  onOpenAddChildModal,
  onNodeClick, // Add this prop
}: ConceptNodeProps & {
  onOpenAddChildModal: (parentNodeId: string) => void;
  onNodeClick: (nodeId: string) => void; // Add this prop
}) {
  // Use new context for colors
  const {
    primaryColor = DEFAULT_PRIMARY_COLOR,
    backgroundColor = DEFAULT_BACKGROUND_COLOR,
  } = useColorThemeContext();

  const { isSelected, targetNodeId } = useNodeSelection();
  const selected = isSelected(node.id) || node.id === targetNodeId;

  const { title, x, y, depth } = node;
 

  // Updated handleNodeClick to use onNodeClick prop
  const handleNodeClick = useCallback(() => {
    onNodeClick(node.id); // Use the onNodeClick prop
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
      onOpenAddChildModal(node.id);
    },
    [node.id, onOpenAddChildModal]
  );

  const handleOpenCueCardModal = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onOpenCueCardModal(node.id);
    },
    [node.id, onOpenCueCardModal]
  );

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

      {/* Add Cue Card Button */}
      <button
        onClick={handleOpenCueCardModal}
        className="absolute bottom-2 right-10 text-black rounded-full w-6 h-6 flex items-center justify-center transition-colors duration-200"
        title="Add Study Resource"
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

ConceptNode.displayName = 'ConceptNode';
ConceptNode.whyDidYouRender = true;

export default memo(ConceptNode, (prevProps, nextProps) => {
  return (
    prevProps.node.id === nextProps.node.id &&
    prevProps.node.title === nextProps.node.title &&
    prevProps.node.x === nextProps.node.x &&
    prevProps.node.y === nextProps.node.y &&
    prevProps.node.isRoot === nextProps.node.isRoot &&
    prevProps.onNodeClick === nextProps.onNodeClick // Include this line
  );
});