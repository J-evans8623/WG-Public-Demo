import React, { useMemo, useCallback, memo } from 'react';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useLayoutContext } from '@/app/Library/Context/LayoutProvider';
import { setGetLayout } from '@/app/Library/Context/LayoutActions';
import ConceptNode from './ConceptNode';
import { ConceptNode as ConceptNodeType } from '@/app/Library/Definitions/Definitions';
import { drawIndentedStyleLines } from '@/app/Library/utils/drawIndentedStyleLines';
import { useDrag, useDrop } from 'react-dnd';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider';
import DashedRing from '@/app/Library/components/DashedRing';

interface SubtreeProps {
  rootNodeId: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  openModalWithResourceType: (nodeId: string | null, resourceType: 'cueCard' | 'picture' | 'practiceSheet' | undefined, op: 'resource' | 'node') => void;
  onNodeClick: (nodeId: string) => void;
}

const Subtree: React.FC<SubtreeProps> = ({
  rootNodeId,
  position,
  width,
  height,
  openModalWithResourceType,
  onNodeClick,
}) => {
  const { nodes } = useNodesContext();
  const { dispatch: layoutDispatch } = useLayoutContext();
  const {
    draggingSubtreeId,
    targetSubtreeId,
    setDraggingSubtreeId,
    setTargetSubtreeId,
    commitSwap,
  } = useSubTreeContext();

  // **Step 1: Handle the sentinel subtree**
  // Check if the subtree being rendered is the sentinel node
  const isSentinelSubtree = rootNodeId === 'sentinel-node';

  // **Step 2: For the sentinel node, render an empty subtree**
  // Instead of returning `null`, render the sentinel with dimensions but no content
  if (isSentinelSubtree) {
    return (
      <div
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          width: `${width}px`,
          height: `${height}px`,
          opacity: 0, // Keep the sentinel invisible
        }}
      />
    );
  }

  // **Dragging logic for draggable subtrees**
  const [{ isDragging }, dragRef] = useDrag<{ id: string }, void, { isDragging: boolean }>({
    type: 'SUBTREE',
    item: () => {
      setDraggingSubtreeId(rootNodeId);
      return { id: rootNodeId };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: () => {
      commitSwap();
      setDraggingSubtreeId(null);
      setTargetSubtreeId(null);
      layoutDispatch(setGetLayout(true));
    },
  });

  const [, dropRef] = useDrop<{ id: string }, void, unknown>({
    accept: 'SUBTREE',
    hover: (draggedItem: { id: string }) => {
      if (draggedItem.id !== rootNodeId && targetSubtreeId !== rootNodeId) {
        setTargetSubtreeId(rootNodeId);
      }
    },
  });

  // **Extract subtree nodes for rendering**
  const subtreeNodes = useMemo(() => {
    const extractedNodes = new Map<string, ConceptNodeType>();
    const extractSubtree = (nodeId: string) => {
      const node = nodes.get(nodeId);
      if (node) {
        extractedNodes.set(nodeId, { ...node });
        node.childrenNodeIds?.forEach((childId) => extractSubtree(childId));
      }
    };
    extractSubtree(rootNodeId);
    return extractedNodes;
  }, [nodes, rootNodeId]);

  // **Callback to manage drag and drop behavior**
  const dragDropRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        dragRef(node);
        dropRef(node);
      }
    },
    [dragRef, dropRef]
  );

  return (
    <div
      ref={dragDropRef}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: `${width}px`,
        height: `${height}px`,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {/* **Step 3: Drawing lines within the subtree** */}
      <svg
        className="absolute top-0 left-0"
        width={width}
        height={height}
        style={{ overflow: 'visible', pointerEvents: 'none' }}
      >
        {drawIndentedStyleLines(subtreeNodes, 5)}
      </svg>

      {/* **Step 4: Rendering each node within the subtree** */}
      {Array.from(subtreeNodes.values()).map((node) => (
        <ConceptNode
          key={node.id}
          node={node}
          openModalWithResourceType={openModalWithResourceType}
          onNodeClick={onNodeClick}
        />
      ))}

      {/* **Step 5: Render DashedRing when dragging over the subtree** */}
      {draggingSubtreeId && targetSubtreeId === rootNodeId && (
        <DashedRing width={width} height={height} position={{ x: 0, y: 0 }} />
      )}
    </div>
  );
};

Subtree.displayName = 'Subtree';

export default memo(Subtree);
