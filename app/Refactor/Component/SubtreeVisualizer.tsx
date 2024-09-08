import React, { useMemo } from 'react';
import { useDocumentContext } from '../Context/DocumentProvider';
import { ConceptNode, colorThemes } from '../Definitions/Definitions';
import { drawLines } from './utils/drawLines';

interface SubtreeVisualizerProps {
  movingNodeId: string; // The ID of the node being moved
}

const SubtreeVisualizer: React.FC<SubtreeVisualizerProps> = ({ movingNodeId }) => {
  const { nodes, colorTheme } = useDocumentContext();

  // Find all nodes in the subtree using a memoized function
  const subtreeNodes = useMemo(() => {
    const findSubtreeNodes = (nodeId: string): Map<string, ConceptNode> => {
      const rootNode = nodes.get(nodeId); // Use 'get' to retrieve the node from the Map
      if (!rootNode) return new Map();

      const subtree = new Map<string, ConceptNode>();
      subtree.set(rootNode.id, rootNode);

      if (rootNode.childrenNodeIds) {
        rootNode.childrenNodeIds.forEach((childId) => {
          const childSubtree = findSubtreeNodes(childId); // Recursively get subtree nodes
          childSubtree.forEach((childNode, id) => {
            subtree.set(id, childNode); // Add each child node to the subtree Map
          });
        });
      }

      return subtree;
    };

    return findSubtreeNodes(movingNodeId);
  }, [movingNodeId, nodes]);

  // Determine the line color based on the global color theme
  const lineColor = colorThemes[colorTheme][5];

  // Draw only the lines for the subtree nodes
  return (
    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
      {drawLines(subtreeNodes, lineColor)} {/* Draw highlighted lines for the subtree */}
    </svg>
  );
};

export default SubtreeVisualizer;
