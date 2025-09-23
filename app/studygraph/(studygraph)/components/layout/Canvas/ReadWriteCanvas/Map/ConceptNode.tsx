/**
 * @file bloom-maps\app\studygraph\(studygraph)\components\layout\Canvas\ReadWriteCanvas\Map\ConceptNode.tsx
 * @description
 * This file implements the **unified ConceptNode** used by both read/write (RW) and read-only (RO)
 * map renderers. Its core responsibility is to render a concept node box with: selection rings,
 * title display (and inline edit in RW), a contextual “+” hover menu for node operations, and a
 * tooltip that exposes quick hints such as alt+click to open slides. The component is designed to
 * be **mode-agnostic**. It reads **Document Access Manager (DAM)** access state using
 * `useDocumentAccessMode()` and applies `isEditReady(mode, status)` to derive a single boolean that
 * controls **all mutating affordances** consistently: inline title edit, add/delete, move/merge,
 * and topic generation. Viewer-safe behaviors—selection, tooltip, slideshow—are always enabled.
 *
 * Design constraints:
 *   1) Preserve existing DOM/CSS hooks, class names, and behavior to avoid visual regressions.
 *   2) Keep all mutating handlers O(1) by early-return gating; avoid prop churn from parent
 *      components by deriving capabilities locally via DAM.
 *   3) Maintain performance using React.memo with a custom comparator that checks identity and a
 *      tiny list of scalar fields plus deep-compare of childrenNodeIds.
 *
 * Observability:
 *   Focused console logs include the file name and unique 4-digit codes to indicate permission
 *   blocks and key state transitions (e.g., opening topic generator). These logs are intentionally
 *   sparse—fired only at high-signal checkpoints to aid debugging without noise.
 *
 * Complexity notes:
 *   - Selection and UI branching are O(1). The memo comparator is O(k) over childrenNodeIds length,
 *     where k is the number of children; this is unavoidable to detect leaf/edge cases, but it
 *     remains linear in the small local array and is unchanged from prior behavior.
 */

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
import TopicGeneratorModal from '../../TopicGeneratorModal';
import '@/app/studygraph/customTooltip.css'
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';
import { useAccessSnapshot, useEditReady } from '@/app/src/context/ApiContext'; 


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
    initiateMerge,
    completeMerge,
    StatusMessage,
    setStatusMessage,
  } = useNodeSelection();
  const { updateNodeTitle, createNewNode, deleteNode, transferNode } = useNodesContext();
  const { dispatch: layoutDispatch } = useLayoutContext();
  const { open } = useSlideShow();

  // 1) DAM → capability gating (centralized here for both RO/RW)  // update - 2
  const { mode, status } = useAccessSnapshot();               // update - 2
  const canEdit = useEditReady();                  // update - 2

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

  // Tooltip state
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const nodeRef = React.useRef<HTMLDivElement>(null);

  /**
   * @function handleSelect
   * @description
   * Handle node selection in O(1) time. This function allows single or multi-selection,
   * and Alt+Click opens a slideshow for the node. If a merge operation is in progress,
   * selecting another node completes the merge (only in edit-ready mode). Viewer actions
   * are always allowed; merge completion is gated by capability to prevent unintended edits.
   */
  const handleSelect = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const isMulti = multiSelectEnabled || e.ctrlKey || e.metaKey;
      const openSlide = e.altKey;

      // 2) Merge completion (only if editing is allowed)          // update - 3
      if (mergeSource !== null && mergeSource !== node.id) {
        if (!canEdit) {
          console.log('[Canvas/ConceptNode.tsx][6201] blocked merge completion (read-only)', { mergeSource, targetId: node.id }); // update - 3
          setStatusMessage('');
          return;
        }
        completeMerge(node.id, transferNode);
        layoutDispatch(setGetLayout(true));
        setStatusMessage('');
        return;
      }

      // 3) Selections are always allowed                          // update - 4
      if (isMulti) {
        multiSelect(node.id, true);
        if (openSlide) open(node.id, true);
      } else {
        singleSelect(node.id);
        if (openSlide) open(node.id, true);
      }
    },
    [
      multiSelectEnabled,
      mergeSource,
      node.id,
      completeMerge,
      transferNode,
      layoutDispatch,
      setStatusMessage,
      multiSelect,
      open,
      singleSelect,
      canEdit, // update - 3
    ]
  );

  /**
   * @function handleTitleDoubleClick
   * @description
   * When the node title is double-clicked, switch into inline editing mode if editing
   * is permitted. This action is O(1) and guarded by DAM to prevent accidental edits
   * when in read-only access or during pending states.
   */
  const handleTitleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) {
      console.log('[Canvas/ConceptNode.tsx][6202] blocked inline rename (read-only)'); // update - 5
      return;
    }
    setIsEditing(true);
  }, [canEdit]); // update - 5

  /**
   * @function handleTitleChange
   * @description
   * Update the local inline-edit buffer. This function does not incur any write to the
   * document store; actual writes happen on finishEditing and remain gated by DAM.
   */
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalTitle(e.target.value);
    },
    []
  );

  /**
   * @function finishEditing
   * @description
   * Commit the inline title change if (a) the title changed and (b) capability allows edits.
   * The handler performs O(1) operations: trim + comparison + dispatch to NodesContext.
   * When edits are blocked, we reset the edit state and emit a focused log.
   */
  const finishEditing = useCallback(() => {
    const trimmed = localTitle.trim();
    if (!canEdit) {
      console.log('[Canvas/ConceptNode.tsx][6203] blocked finishEditing (read-only)', { attempted: trimmed }); // update - 6
      setIsEditing(false);
      setLocalTitle(title);
      return;
    }
    if (trimmed && trimmed !== title) {
      updateNodeTitle(node.id, trimmed);
      console.log('[Canvas/ConceptNode.tsx][6204] title updated', { id: node.id, title: trimmed }); // update - 6
    }
    setIsEditing(false);
  }, [localTitle, title, node.id, updateNodeTitle, canEdit]); // update - 6

  /**
   * @function handleKeyDown
   * @description
   * Keyboard handler for committing (Enter) or cancelling (Escape) inline edits.
   * This remains O(1) and delegates to finishEditing while preserving DAM gating.
   */
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

  // Tooltip handlers (viewer-safe)
  const handleMouseEnter = useCallback(() => {
    if (mergeSource && mergeSource !== node.id) setStatusMessage('Move here');
    else if (!mergeSource) setStatusMessage(title);

    if (nodeRef.current) {
      const rect = nodeRef.current.getBoundingClientRect();
      setTooltipPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 75
      });
      setShowTooltip(true);
    }
  }, [mergeSource, node.id, title, setStatusMessage]);

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false);
    setStatusMessage('');
  }, [setStatusMessage]);

  /**
   * @function handleMergeInitiate
   * @description
   * Start a “move/merge” operation for this node (disallowed on the root). This handler is
   * gated by `canEdit`. It performs O(1) checks and sets up state via NodeSelectionContext.
   */
  const handleMergeInitiate = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!canEdit) {
        console.log('[Canvas/ConceptNode.tsx][6205] blocked move/merge initiate (read-only)'); // update - 7
        return;
      }
      if (isRoot) {
        alert('The root node cannot be moved.');
        return;
      }
      initiateMerge(node.id);
      setStatusMessage('');
    },
    [node.id, isRoot, initiateMerge, setStatusMessage, canEdit] // update - 7
  );

  /**
   * @function handleAddChildNode
   * @description
   * Create a new child node under the current node (O(1) work besides UUID generation and
   * context dispatch). Guarded by DAM to prevent edits in read-only or pending states.
   */
  const handleAddChildNode = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!canEdit) {
        console.log('[Canvas/ConceptNode.tsx][6206] blocked create node (read-only)'); // update - 8
        return;
      }
      const newId = uuidv4();
      createNewNode('New Concept', node.id, newId);
      layoutDispatch(setGetLayout(true));
      console.log('[Canvas/ConceptNode.tsx][6207] child created', { parentId: node.id, newId }); // update - 8
    },
    [node.id, createNewNode, layoutDispatch, canEdit] // update - 8
  );

  /**
   * @function handleDeleteNode
   * @description
   * Delete the current node if it is a leaf and not the root. Gated by DAM and
   * kept O(1) by early checks on `isRoot` and `childrenNodeIds.length`.
   */
  const handleDeleteNode = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!canEdit) {
        console.log('[Canvas/ConceptNode.tsx][6208] blocked delete node (read-only)'); // update - 9
        return;
      }
      if (isRoot) {
        alert('The root node cannot be deleted.');
        return;
      }
      if (childrenNodeIds.length > 0) {
        alert('Only leaf nodes can be deleted. Remove its children first.');
        return;
      }
      deleteNode(node.id);
      layoutDispatch(setGetLayout(true));
      console.log('[Canvas/ConceptNode.tsx][6209] node deleted', { id: node.id }); // update - 9
    },
    [isRoot, childrenNodeIds, node.id, deleteNode, layoutDispatch, canEdit] // update - 9
  );

  /**
   * @function handleExploreTopic
   * @description
   * Open the Topic Generator modal for this node. This is a mutating capability that may
   * create new materials; thus it is gated by DAM and O(1) to toggle modal state.
   */
  const handleExploreTopic = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) {
      console.log('[Canvas/ConceptNode.tsx][6210] blocked topic generator (read-only)'); // update - 10
      return;
    }
    setIsTopicGeneratorOpen(true);
    console.log('[Canvas/ConceptNode.tsx][6211] topic generator opened', { id: node.id }); // update - 10
  }, [canEdit, node.id]); // update - 10

  // Hover‐menu open/close (only meaningful if canEdit; still safe to compute) // update - 11
  const handleMenuEnter = useCallback(() => {
    if (!canEdit) return; // guard hover activation // update - 11
    if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({ x: rect.left, y: rect.bottom + window.scrollY });
      setShowMenu(true);
    }
  }, [canEdit]); // update - 11

  const handleMenuLeave = useCallback(() => {
    if (!canEdit) return; // update - 12
    menuTimeoutRef.current = setTimeout(() => setShowMenu(false), 150);
  }, [canEdit]); // update - 12

  const handleMenuOpen = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!canEdit) {
        console.log('[Canvas/ConceptNode.tsx][6212] blocked open hover menu (read-only)'); // update - 13
        return;
      }
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setMenuPosition({ x: rect.left, y: rect.bottom + window.scrollY });
        setShowMenu(true);
      }
    },
    [canEdit] // update - 13
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
          zIndex:
            isSelected(node.id) || node.id === targetNodeId || mergeSource === node.id
              ? 10
              : 1,
          boxSizing: 'border-box',
          transition: 'none',
          // Border coloring mirrors the original RO version for visual parity  // update - 14
          border:
            isSelected(node.id) || node.id === targetNodeId || mergeSource === node.id
              ? undefined
              : `3px solid ${OUTLINE_COLOR}`,
          backgroundColor: nodeColor, // update - 14
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
          {isEditing && canEdit ? (  // update - 15
            <input
              type="text"
              value={localTitle}
              onChange={handleTitleChange}
              onBlur={finishEditing}
              onKeyDown={handleKeyDown}
              autoFocus
              className="text-center font-semibold"
            />
          ) : (
            <p
              className={canEdit ? 'node-title' : 'text-center font-bold line-clamp-2 text-gray-600'} // update - 16
              onDoubleClick={handleTitleDoubleClick} // harmless in RO due to gating
            >
              {title}
            </p>
          )}
        </div>

        {/* Hover "+" menu trigger — rendered only when editing is allowed */} {/* update - 17 */}
        {canEdit && (
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
        )}

        {/* Hover menu contents — visible only if canEdit and showMenu true */} {/* update - 18 */}
        {canEdit && showMenu &&
          createPortal(
            <div
              ref={menuRef}
              onMouseEnter={handleMenuEnter}
              onMouseLeave={handleMenuLeave}
              className="fixed z-50 bg-white shadow-lg rounded-md border border-gray-200 py-1 w-36"
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

      {/* Tooltip rendered via portal (viewer-safe, always allowed) */}
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

      {/* Topic generator modal — gated by canEdit */} {/* update - 19 */}
      {canEdit && isTopicGeneratorOpen &&
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
 * Now includes childrenNodeIds (length and content) so that when a node's
 * children are removed (i.e. it becomes a leaf), the component re-renders
 * and its "delete" logic updates accordingly.
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
    // deep-compare children arrays (O(k), k = #children)
    if (p.childrenNodeIds.length !== n.childrenNodeIds.length) return false;
    for (let i = 0; i < p.childrenNodeIds.length; i++) {
      if (p.childrenNodeIds[i] !== n.childrenNodeIds[i]) return false;
    }
    return true;
  }
);
