// ConceptNode.tsx

import React, {
  memo,
  useCallback,
  useState,
  useEffect,
  forwardRef,
} from 'react';
import { ConceptNode as NodeType } from '@/app/Library/Definitions/Definitions';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import { Plus, Trash2, Pencil, GitBranch, Sparkles } from 'lucide-react';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { v4 as uuidv4 } from 'uuid';
import { useLayoutContext } from '@/app/Library/Context/LayoutProvider';
import { setGetLayout } from '@/app/Library/Context/LayoutActions';
import { layoutConfig } from '@/app/Library/Definitions/Definitions';
import { createPortal } from 'react-dom';
import TopicGeneratorModal from './TopicGeneratorModal';

const GENERAL_SELECTED_COLOR = '#3B82F6';
const CARET_COLOR = '#FF6500';
const TARGET_COLOR = '#28A745';
const OUTLINE_COLOR = '#6e6e6e';

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
    initiateMerge,
    completeMerge,
    setStatusMessage,
  } = useNodeSelection();
  const { updateNodeTitle, createNewNode, deleteNode, transferNode } = useNodesContext();
  const { dispatch: layoutDispatch } = useLayoutContext();

  const { title, depth, x, y, childrenNodeIds, isRoot } = node;
  const [isEditing, setIsEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);

  // Hover‐menu state
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const menuRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuTimeoutRef = React.useRef<NodeJS.Timeout>();

  // Topic generator modal
  const [isTopicGeneratorOpen, setIsTopicGeneratorOpen] = useState(false);

  // Selection handlers
  const handleSelect = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const isMulti = multiSelectEnabled || e.ctrlKey || e.metaKey;
      if (mergeSource !== null && mergeSource !== node.id) {
        completeMerge(node.id, transferNode);
        layoutDispatch(setGetLayout(true));
        setStatusMessage('');
      } else {
        if (isMulti) multiSelect(node.id, true);
        else singleSelect(node.id);
      }
    },
    [
      node.id,
      mergeSource,
      multiSelectEnabled,
      multiSelect,
      singleSelect,
      completeMerge,
      transferNode,
      layoutDispatch,
      setStatusMessage,
    ]
  );

  const handleTitleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  }, []);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalTitle(e.target.value);
    },
    []
  );

  const finishEditing = useCallback(() => {
    const trimmed = localTitle.trim();
    if (trimmed && trimmed !== title) {
      updateNodeTitle(node.id, trimmed);
    }
    setIsEditing(false);
  }, [localTitle, title, node.id, updateNodeTitle]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') finishEditing();
      else if (e.key === 'Escape') {
        setLocalTitle(title);
        setIsEditing(false);
      }
    },
    [finishEditing, title]
  );

  // Node operations
  const handleMergeInitiate = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isRoot) {
        alert('The root node cannot be moved.');
        return;
      }
      initiateMerge(node.id);
      setStatusMessage('');
    },
    [node.id, isRoot, initiateMerge, setStatusMessage]
  );

  const handleAddChildNode = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const newId = uuidv4();
      createNewNode('New Concept', node.id, newId);
      layoutDispatch(setGetLayout(true));
    },
    [node.id, createNewNode, layoutDispatch]
  );

  const handleDeleteNode = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isRoot) {
        alert('The root node cannot be deleted.');
        return;
      }
      // Allow delete only if truly a leaf
      if (childrenNodeIds.length > 0) {
        alert('Only leaf nodes can be deleted. Remove its children first.');
        return;
      }
      deleteNode(node.id);
      layoutDispatch(setGetLayout(true));
    },
    [isRoot, childrenNodeIds, node.id, deleteNode, layoutDispatch]
  );

  const handleExploreTopic = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsTopicGeneratorOpen(true);
  }, []);

  // Hover‐menu open/close
  const handleMenuEnter = useCallback(() => {
    if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({ x: rect.left, y: rect.bottom + window.scrollY });
      setShowMenu(true);
    }
  }, []);

  const handleMenuLeave = useCallback(() => {
    menuTimeoutRef.current = setTimeout(() => setShowMenu(false), 150);
  }, []);

  const handleMenuOpen = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setMenuPosition({ x: rect.left, y: rect.bottom + window.scrollY });
        setShowMenu(true);
      }
    },
    []
  );

  // Click‐outside to close hover menu
  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Styling for selection rings
  const focusNodeId = getFocusNode();
  const isCaretNode = node.id === focusNodeId;
  const isTargetNode = node.id === targetNodeId && node.id !== focusNodeId;
  let ringColor: string | null = null;
  if (isCaretNode) ringColor = CARET_COLOR;
  else if (isTargetNode) ringColor = TARGET_COLOR;
  else if (isSelected(node.id) || node.id === targetNodeId) ringColor = GENERAL_SELECTED_COLOR;
  const nodeColor = depth === 1 ? primaryColor : backgroundColor;

  return (
    <>
      <div
        ref={isRoot ? ref : null}
        onClick={handleSelect}
        onMouseEnter={() => {
          if (mergeSource && mergeSource !== node.id) setStatusMessage('Move here');
          else if (!mergeSource) setStatusMessage(title);
        }}
        onMouseLeave={() => setStatusMessage('')}
        className={`relative flex flex-col items-center cursor-pointer group rounded-md shadow-md transition-all duration-200 ${
          isSelected(node.id) || node.id === targetNodeId || mergeSource === node.id
            ? 'bg-blue-50 shadow-lg'
            : 'bg-white shadow-md'
        }`}
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
          {isEditing ? (
            <input
              type="text"
              value={localTitle}
              onChange={handleTitleChange}
              onBlur={finishEditing}
              onKeyDown={handleKeyDown}
              autoFocus
              className="text-center font-semibold text-gray-800"
            />
          ) : (
            <p
              className="text-center font-semibold text-gray-800 line-clamp-3"
              onDoubleClick={handleTitleDoubleClick}
              title="Double-click to edit title"
            >
              {title}
            </p>
          )}
        </div>

        {/* Hover “+” menu trigger */}
        <div
          className="group/menu absolute bottom-2 right-2"
          onMouseEnter={handleMenuEnter}
          onMouseLeave={handleMenuLeave}
        >
          <button
            ref={buttonRef}
            onClick={handleMenuOpen}
            className="p-1.5 rounded-full bg-gray-200 shadow-md hover:bg-gray-900 transition-colors flex items-center justify-center"
          >
            <Plus className="w-5 h-5 text-gray-900 group-hover/menu:text-white" />
          </button>
        </div>

        {/* Hover menu contents */}
        {showMenu &&
          createPortal(
            <div
              ref={menuRef}
              onMouseEnter={handleMenuEnter}
              onMouseLeave={handleMenuLeave}
              className="fixed bg-white shadow-lg rounded-md border border-gray-200 py-1 w-36"
              style={{ left: menuPosition.x, top: menuPosition.y }}
            >
              <button
                onClick={(e) => {
                  handleAddChildNode(e);
                  setShowMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 text-sm flex items-center gap-2 hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" />
                <span>Add node</span>
              </button>

              <button
                onClick={(e) => {
                  handleTitleDoubleClick(e);
                  setShowMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 text-sm flex items-center gap-2 hover:bg-gray-50"
              >
                <Pencil className="w-4 h-4" />
                <span>Edit title</span>
              </button>

              {!isRoot && childrenNodeIds!.length === 0 && (
                <button
                  onClick={(e) => {
                    handleDeleteNode(e);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-sm flex items-center gap-2 hover:bg-gray-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete node</span>
                </button>
              )}

              {mergeSource === null && !isRoot && (
                <button
                  onClick={(e) => {
                    handleMergeInitiate(e);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-sm flex items-center gap-2 hover:bg-gray-50"
                >
                  <GitBranch className="w-4 h-4" />
                  <span>Move node</span>
                </button>
              )}

              <button
                onClick={(e) => {
                  handleExploreTopic(e);
                  setShowMenu(false);
                }}
                className="w-full text-left px-2.5 py-1.5 text-sm flex items-center gap-2 hover:bg-gray-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>Explore Topic</span>
              </button>
            </div>,
            document.body
          )}
      </div>

      {/* Topic generator modal */}
      {isTopicGeneratorOpen &&
        createPortal(
          <TopicGeneratorModal
            isOpen
            onClose={() => setIsTopicGeneratorOpen(false)}
            targetNodeId={node.id}
          />,
          document.getElementById('modal-root') || document.body
        )}
    </>
  );
});

// Display name for dev tools
ConceptNode.displayName = 'ConceptNode';

/**
 * Custom props‐equality for React.memo:
 *   Now includes childrenNodeIds (length and content) so that when a node’s
 *   children are removed (i.e. it becomes a leaf), the component re-renders
 *   and its “delete” logic updates accordingly.
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
