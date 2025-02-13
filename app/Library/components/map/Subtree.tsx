import React, { useMemo, useCallback, memo } from 'react';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useLayoutContext } from '@/app/Library/Context/LayoutProvider';
import { setGetLayout } from '@/app/Library/Context/LayoutActions';
import ConceptNode from './ConceptNode';
import { ConceptNode as ConceptNodeType } from '@/app/Library/Definitions/Definitions';
import { drawIndentedStyleLines } from '@/app/Library/utils/drawIndentedStyleLines';
import { useDrag, useDrop } from 'react-dnd';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider';
import DashedRing from '@/app/Library/components/map/DashedRing';

interface SubtreeProps {
  rootNodeId: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  openModalWithResourceType: (
    nodeId: string | null,
    resourceType: 'cueCard' | 'picture' | 'practiceSheet' | undefined,
    op: 'resource' | 'node'
  ) => void;
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

  const subtreeNodes = useMemo(() => {
    if (rootNodeId === 'sentinel-node') {
      return new Map<string, ConceptNodeType>();
    }

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

  const [{ isDragging }, dragRef] = useDrag<{ id: string }, void, { isDragging: boolean }>({
    type: 'SUBTREE',
    item: () => {
      if (rootNodeId !== 'sentinel-node') {
        setDraggingSubtreeId(rootNodeId);
      }
      return { id: rootNodeId };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: () => {
      if (rootNodeId !== 'sentinel-node') {
        commitSwap();
        setDraggingSubtreeId(null);
        setTargetSubtreeId(null);
        layoutDispatch(setGetLayout(true));
      }
    },
  });

  const [, dropRef] = useDrop<{ id: string }, void, unknown>({
    accept: 'SUBTREE',
    hover: (draggedItem: { id: string }) => {
      if (rootNodeId !== 'sentinel-node' && 
          draggedItem.id !== rootNodeId && 
          targetSubtreeId !== rootNodeId) {
        setTargetSubtreeId(rootNodeId);
      }
    },
  });

  const dragDropRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        dragRef(node);
        dropRef(node);
      }
    },
    [dragRef, dropRef]
  );

  if (rootNodeId === 'sentinel-node') {
    return (
      <div
        ref={dragDropRef}
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          width: `${width}px`,
          height: `${height}px`,
          opacity: 0,
        }}
      />
    );
  }

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
      <svg
        className="absolute top-0 left-0"
        width={width}
        height={height}
        style={{ overflow: 'visible', pointerEvents: 'none' }}
      >
        {drawIndentedStyleLines(subtreeNodes, 5)}
      </svg>

      {Array.from(subtreeNodes.values()).map((node) => (
        <ConceptNode
          key={node.id}
          node={node}
          openModalWithResourceType={openModalWithResourceType}
          onNodeClick={onNodeClick}
        />
      ))}

      {draggingSubtreeId && targetSubtreeId === rootNodeId && (
        <DashedRing width={width} height={height} position={{ x: 0, y: 0 }} />
      )}
    </div>
  );
};

Subtree.displayName = 'Subtree';

export default memo(Subtree);