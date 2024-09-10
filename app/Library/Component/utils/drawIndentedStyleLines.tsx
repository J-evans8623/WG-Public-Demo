// drawIndentedStyleLines.tsx

import React from 'react';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';

export function drawIndentedStyleLines(nodes: Map<string, ConceptNode>, lineWidth: number): JSX.Element[] {
  const lineElements: JSX.Element[] = [];

  // Get nodes with depth greater than 1
  const depthGreaterThanOneNodes = Array.from(nodes.values()).filter(node => node.depth > 1);

  depthGreaterThanOneNodes.forEach(node => {
    if (node.parentNodeId) {
      const parentNode = nodes.get(node.parentNodeId);

      if (parentNode && parentNode.x !== undefined && parentNode.y !== undefined) {
        const parentPCP = { x: parentNode.x + 25, y: parentNode.y + 150 }; // 1/8th width from the left bottom of the parent node
        const childCCP = { x: node.x ?? 0, y: node.y ? node.y + 75 : 75 }; // Midpoint left of each child node

        // Draw vertical anchor line between parent PCP and child CCPs
        lineElements.push(
          <line
            key={`line-pcp-to-child-${node.id}`}
            x1={parentPCP.x}
            y1={parentPCP.y}
            x2={parentPCP.x}
            y2={childCCP.y}
            stroke="black"
            strokeWidth={lineWidth} // Use centralized line width
          />
        );

        // Draw lines connecting each child CCP to the vertical anchor line
        lineElements.push(
          <line
            key={`line-ccp-to-anchor-${node.id}`}
            x1={childCCP.x}
            y1={childCCP.y}
            x2={parentPCP.x}
            y2={childCCP.y}
            stroke="black"
            strokeWidth={lineWidth} // Use centralized line width
          />
        );
      }
    }
  });

  return lineElements;
}
