
// bloom-maps\app\Library\components\Subtree.tsx
import React, { useMemo } from 'react';
import { ConceptNode as ConceptNodeType } from '@/app/Library/Definitions/Definitions';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';
import ConceptNode from '../components/ConceptNode';
import { drawIndentedStyleLines } from '@/app/Library/utils/drawIndentedStyleLines';

interface SubtreeProps {
  rootNodeId: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  onOpenCueCardModal: (nodeId: string) => void;
}

const Subtree: React.FC<SubtreeProps> = ({
  rootNodeId,
  position,
  width,
  height,
  onOpenCueCardModal,
}) => {
  const { state } = useDocumentContext();
  const { nodes } = state;

  // Extract subtree nodes
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
        />
      ))}
    </div>
  );
};

export default Subtree;
