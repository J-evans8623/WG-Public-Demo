import React, { useMemo, useCallback } from 'react';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';
import ConceptNode from './ConceptNode';
import { ConceptNode as ConceptNodeType } from '@/app/Library/Definitions/Definitions';
import { drawIndentedStyleLines } from '@/app/Library/utils/drawIndentedStyleLines';
import { useDrag, useDrop } from 'react-dnd';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider'; // Corrected import path
import DashedRing from './DashedRing';

interface SubtreeProps {
  rootNodeId: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  onOpenCueCardModal: (nodeId: string) => void;
  onOpenAddChildModal: (parentNodeId: string) => void;
}

const Subtree: React.FC<SubtreeProps> = ({
  rootNodeId,
  position,
  width,
  height,
  onOpenCueCardModal,
  onOpenAddChildModal,
}) => {
  const { state } = useDocumentContext();
  const { nodes } = state;
  const {
    draggingSubtreeId,
    targetSubtreeId,
    setDraggingSubtreeId,
    setTargetSubtreeId,
    commitSwap,
  } = useSubTreeContext();

  const [{ isDragging }, dragRef] = useDrag<
    { id: string },    // DragObject
    void,              // DropResult
    { isDragging: boolean }  // CollectedProps
  >({
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
    },
  });

  const [, dropRef] = useDrop<
    { id: string },  // DragObject
    void,            // DropResult
    unknown          // CollectedProps
  >({
    accept: 'SUBTREE',
    hover: (draggedItem: { id: string }) => {
      if (
        draggedItem.id !== rootNodeId &&
        targetSubtreeId !== rootNodeId
      ) {
        setTargetSubtreeId(rootNodeId);
      }
    },
  });

  // Extract subtree nodes
  const subtreeNodes = useMemo(() => {
    const extractedNodes = new Map<string, ConceptNodeType>();
    const extractSubtree = (nodeId: string) => {
      const node = nodes.get(nodeId);
      if (node) {
        extractedNodes.set(nodeId, { ...node });
        node.childrenNodeIds?.forEach((childId) =>
          extractSubtree(childId)
        );
      }
    };
    extractSubtree(rootNodeId);
    return extractedNodes;
  }, [nodes, rootNodeId]);

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
      {/* Draw lines within the subtree */}
      <svg
        className="absolute top-0 left-0"
        width={width}
        height={height}
        style={{ overflow: 'visible', pointerEvents: 'none' }}
      >
        {drawIndentedStyleLines(subtreeNodes, 4)}
      </svg>
      {/* Render nodes within the subtree */}
      {Array.from(subtreeNodes.values()).map((node) => (
        <ConceptNode
          key={node.id}
          node={node}
          onOpenCueCardModal={onOpenCueCardModal}
          onOpenAddChildModal={onOpenAddChildModal}
        />
      ))}
      {/* Render DashedRing when dragging over */}
      {draggingSubtreeId && targetSubtreeId === rootNodeId && (
        <DashedRing
          width={width}
          height={height}
          position={{ x: 0, y: 0 }}
        />
      )}
    </div>
  );
};

export default Subtree;
/**
 * Original
 * 
 */