// bloom-maps/app/Library/utils/drawIndentedStyleLines.tsx

import React from 'react';
import { ConceptNode, layoutConfig } from '@/app/Library/Definitions/Definitions';


export function drawIndentedStyleLines(
  nodes: Map<string, ConceptNode>,
  lineWidth: number,
  strokeColor: string = '#6e6e6e' // Default gray color
): JSX.Element[] {
  const lineElements: JSX.Element[] = [];

  // Define default node dimensions
  const nodeWidth = layoutConfig.nodewidth;
  const nodeHeight = layoutConfig.nodeheight;

  const depthGreaterThanOneNodes = Array.from(nodes.values()).filter(node => node.depth > 1);

  depthGreaterThanOneNodes.forEach(node => {
    if (node.parentNodeId) {
      const parentNode = nodes.get(node.parentNodeId);

      if (parentNode && parentNode.x !== undefined && parentNode.y !== undefined) {
        // Parent Connection Point (PCP) at the bottom left corner of the parent node, slightly offset to the right
        const parentPCP = { x: (parentNode.x ?? 0) + nodeWidth / 8, y: (parentNode.y ?? 0) + nodeHeight };
        
        // Child Connection Point (CCP) at the midpoint of the left side of the child node
        const childCCP = { x: node.x ?? 0, y: (node.y ?? 0) + nodeHeight / 2 };

        // Draw the vertical line from the parent node to the anchor point
        lineElements.push(
          <path
            key={`curve-pcp-to-child-${node.id}`}
            d={`M ${parentPCP.x},${parentPCP.y} Q ${parentPCP.x},${(parentPCP.y + childCCP.y) / 2} ${parentPCP.x},${childCCP.y}`}
            stroke={strokeColor}
            strokeWidth={lineWidth}
            fill="none"
          />
        );

        // Draw the horizontal line from the anchor point to the child node
        lineElements.push(
          <path
            key={`curve-ccp-to-anchor-${node.id}`}
            d={`M ${childCCP.x},${childCCP.y} Q ${(childCCP.x + parentPCP.x) / 2},${childCCP.y} ${parentPCP.x},${childCCP.y}`}
            stroke={strokeColor}
            strokeWidth={lineWidth}
            fill="none"
          />
        );
      }
    }
  });

  return lineElements;
}
