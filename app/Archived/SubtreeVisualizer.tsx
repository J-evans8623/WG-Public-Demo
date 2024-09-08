// bloom-maps/app/Component/SubtreeVisualizer.tsx

import React, { useMemo } from 'react';
import { useDocumentContext } from '@/app/Archived/DocumentProvider';
import { ConceptNode, colorThemes } from '@/app/Archived/Definitions/Definitions';
import { drawLines } from '@/app/Component/drawLines';

interface SubtreeVisualizerProps {
    movingNodeId: string; // The ID of the node being moved
  }
  
  const SubtreeVisualizer: React.FC<SubtreeVisualizerProps> = ({ movingNodeId }) => {
    const { nodes, colorTheme } = useDocumentContext();
  
    // Find all nodes in the subtree using a memoized function
    const subtreeNodes = useMemo(() => {
      const findSubtreeNodes = (nodeId: string): ConceptNode[] => {
        const rootNode = nodes.find((node) => node.id === nodeId);
        if (!rootNode) return [];
  
        const subtree: ConceptNode[] = [rootNode];
        if (rootNode.childrenNodeIds) {
          rootNode.childrenNodeIds.forEach((childId) => {
            subtree.push(...findSubtreeNodes(childId));
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