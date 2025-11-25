/**
 * Concept Node.tsx
 * 
 * Read only
 */

import React, {
  memo,
  useCallback,
  useState,
  forwardRef,
} from 'react';
import { ConceptNode as NodeType } from '@/app/Library/Definitions/Definitions';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import { useLayoutContext } from '@/app/Library/Context/LayoutProvider';
import { setGetLayout } from '@/app/Library/Context/LayoutActions';
import { layoutConfig } from '@/app/Library/Definitions/Definitions';
import { createPortal } from 'react-dom';
import '@/app/workspace/customTooltip.css'
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';

const GENERAL_SELECTED_COLOR = '#3B82F6';
const CARET_COLOR = '#FF6500';
const TARGET_COLOR = '#28A745';
const OUTLINE_COLOR = '#9e9e9e';

interface ConceptNodeProps {
  node: NodeType;
}

const ConceptNode = forwardRef<HTMLDivElement, ConceptNodeProps>(({ node }, ref) => {
  const { primaryColor, backgroundColor } = useColorThemeContext();
  const {
    isSelected,
    targetNodeId,
    getFocusNode,
    singleSelect,
    multiSelect,
    multiSelectEnabled,
    mergeSource,
    setStatusMessage,
  } = useNodeSelection();
  const { dispatch: layoutDispatch } = useLayoutContext();
  const { open } = useSlideShow();

  const { title, depth, x, y, childrenNodeIds, isRoot } = node;



  // Tooltip state
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const nodeRef = React.useRef<HTMLDivElement>(null);

  // Selection handlers
  const handleSelect = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const isMulti = multiSelectEnabled || e.ctrlKey || e.metaKey;
      const openSlide = e.altKey
      if (mergeSource !== null && mergeSource !== node.id) {
        layoutDispatch(setGetLayout(true));
        setStatusMessage('');
      } else {
        if (isMulti) {
          multiSelect(node.id, true); 
          if (openSlide) open(node.id, true)
        }
        else {
          singleSelect(node.id)
          if (openSlide) open(node.id, true)
        };
      }
    },
    [multiSelectEnabled, mergeSource, node.id, layoutDispatch, setStatusMessage, multiSelect, open, singleSelect]
  );


  // Tooltip handlers
  const handleMouseEnter = useCallback(() => {
    // Set the status message first
    if (mergeSource && mergeSource !== node.id) setStatusMessage('Move here');
    else if (!mergeSource) setStatusMessage(title);
    
    // Then show tooltip if we have a node reference
    if (nodeRef.current) {
      const rect = nodeRef.current.getBoundingClientRect();
      setTooltipPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 75 // Position above the node
      });
      setShowTooltip(true);
    }
  }, [mergeSource, node.id, title, setStatusMessage]);

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false);
    setStatusMessage('');
  }, [setStatusMessage]);


  // Styling for selection rings
  const focusNodeId = getFocusNode();
  const isCaretNode = node.id === focusNodeId;
  const isTargetNode = node.id === targetNodeId && node.id !== focusNodeId;
  let ringColor: string | null = null;
  if (isCaretNode) ringColor = CARET_COLOR;
  else if (isTargetNode) ringColor = TARGET_COLOR;
  else if (isSelected(node.id) || node.id === targetNodeId) ringColor = GENERAL_SELECTED_COLOR;
  const nodeColor = depth === 1 ? primaryColor : backgroundColor;
  const isDepthOne = depth === 1;
  return (
    <>
      <div
        ref={nodeRef}
        onClick={handleSelect}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`
          node ${isDepthOne ? 'main' : ''} fixed
          relative flex flex-col items-center cursor-pointer group
          transition-all duration-200
          ${isSelected(node.id) || node.id === targetNodeId || mergeSource === node.id ? '' : ''}
        `}
        style={{
          width: `${layoutConfig.nodewidth}px`,
          height: `${layoutConfig.nodeheight}px`,
          position: 'absolute',
          left: `${x}px`,
          top: `${y}px`,
          backgroundColor: nodeColor,
          zIndex:
            isSelected(node.id) || node.id === targetNodeId || mergeSource === node.id
              ? 10
              : 1,
          border:
            isSelected(node.id) || node.id === targetNodeId || mergeSource === node.id
              ? 'none'
              : `3px solid ${OUTLINE_COLOR}`,
          boxSizing: 'border-box',
          transition: 'none',
        }}
        role="button"
        tabIndex={0}
      >
        {ringColor && (
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

        <div className="flex-1 flex items-center justify-center p-4">
            <p
              className="text-center font-bold line-clamp-2 text-gray-600"
            >
              {title}
            </p>
        </div>

      </div>

      {/* Tooltip rendered via portal */}
      {showTooltip &&
        createPortal(
          <div
            className="fixed bg-gray-800 text-white px-3 py-2 rounded-md text-sm shadow-lg z-50 pointer-events-none line-clamp"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
              transform: 'translateX(-50%)',
              maxWidth: '900px',
              maxHeight: '75px',
              lineHeight: '1.4'
            }}
          >
            <div className="font-semibold mb-1">
              {mergeSource && mergeSource !== node.id ? 'Move here' : title}
            </div>
            <div className="text-xs text-gray-300">
                <div>click to preview</div>
                <div>alt + click to view slide</div>
              </div>
          </div>,
          document.body
        )}

      {/* Topic generator modal */}
    </>
  );
});

// Display name for dev tools
ConceptNode.displayName = 'ConceptNode';

/**
 * Custom props‐equality for React.memo:
 *   Now includes childrenNodeIds (length and content) so that when a node's
 *   children are removed (i.e. it becomes a leaf), the component re-renders
 *   and its "delete" logic updates accordingly.
 */
export default memo(
  ConceptNode,
  (prevProps, nextProps) => {
    const p = prevProps.node;
    const n = nextProps.node;
    // shallow compare all key layout/identity fields
    const sameCore =
      p.id === n.id &&
      p.title === n.title &&
      p.x === n.x &&
      p.y === n.y &&
      p.isRoot === n.isRoot;
    if (!sameCore) return false;
    // deep-compare children arrays
    if (p.childrenNodeIds.length !== n.childrenNodeIds.length) return false;
    for (let i = 0; i < p.childrenNodeIds.length; i++) {
      if (p.childrenNodeIds[i] !== n.childrenNodeIds[i]) return false;
    }
    return true;
  }
);