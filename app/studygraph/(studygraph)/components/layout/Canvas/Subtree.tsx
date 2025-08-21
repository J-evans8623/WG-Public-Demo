// components/layout/Canvas/Subtree.tsx (edit mode)
import React, { useMemo, useCallback } from 'react';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import ConceptNode from './ConceptNode';
import { ConceptNode as ConceptNodeType } from '@/app/Library/Definitions/Definitions';
import { drawIndentedStyleLines } from '@/app/Library/utils/drawIndentedStyleLines';

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
}) => {
  const { nodes } = useNodesContext();

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

  return (
    <div
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: `${width}px`,
        height: `${height}px`,
      }}
    >
      <svg
        className="absolute top-0 left-0"
        width={width}
        height={height}
        style={{ overflow: 'visible', pointerEvents: 'none' }}
      >
        {drawIndentedStyleLines(subtreeNodes, 3)}
      </svg>

      {Array.from(subtreeNodes.values()).map((node) => (
        <ConceptNode
          key={node.id}
          node={node}
        />
      ))}
    </div>
  );
};

export default Subtree;