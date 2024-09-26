import React, { useMemo } from 'react';
import { useDocumentContext } from '../Context/DocumentProvider'; // Updated to use DocumentProvider
import { ConceptNode, colorThemes } from '../Definitions/Definitions';
import { drawHVStyleLines } from '../utils/drawHVStyleLines';
import { drawIndentedStyleLines } from '../utils/drawIndentedStyleLines';

interface SubtreeVisualizerProps {
  movingNodeId: string; // The ID of the node being moved
}

const SubtreeVisualizer: React.FC<SubtreeVisualizerProps> = ({ movingNodeId }) => {
  const { state } = useDocumentContext(); // Use new context
  const { nodes, colorTheme } = state; // Destructure state values

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

  // Draw lines based on the layout type for each node in the subtree
  const subtreeLines = useMemo(() => {
    const hvLines: JSX.Element[] = [];
    const indentedLines: JSX.Element[] = [];

    subtreeNodes.forEach((node) => {
      if (node.depth <= 1) {
        hvLines.push(...drawHVStyleLines(subtreeNodes, 2, lineColor)); // Pass color parameter
      } else {
        indentedLines.push(...drawIndentedStyleLines(subtreeNodes, 2, lineColor)); // Pass color parameter
      }
    });

    return [...hvLines, ...indentedLines];
  }, [subtreeNodes, lineColor]);

  // Draw only the lines for the subtree nodes
  return (
    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
      {subtreeLines} {/* Draw highlighted lines for the subtree */}
    </svg>
  );
};

export default SubtreeVisualizer;
