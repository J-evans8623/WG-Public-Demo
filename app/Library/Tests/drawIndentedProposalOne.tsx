// bloom-maps/app/Library/utils/drawIndentedStyleLines.tsx
import React from 'react';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';

export function drawIndentedStyleLines(
  nodes: Map<string, ConceptNode>,
  lineWidth: number,
  strokeColor: string = '#6e6e6e' // Default gray color
): JSX.Element[] {
  const lineElements: JSX.Element[] = [];

  // Define default node dimensions
  const nodeWidth = 325;
  const nodeHeight = 125;

  const depthGreaterThanOneNodes = Array.from(nodes.values()).filter(node => node.depth > 1);

  depthGreaterThanOneNodes.forEach(node => {
    if (node.parentNodeId) {
      const parentNode = nodes.get(node.parentNodeId);

      if (parentNode && parentNode.x !== undefined && parentNode.y !== undefined) {
        // Calculate the center bottom point of the parent node
        const parentPCP = { x: parentNode.x + nodeWidth / 2, y: parentNode.y + nodeHeight };

        // Calculate the center top point of the child node
        const childTCP = { x: node.x? node.x: 0 + nodeWidth / 2, y: node.y };

        // Draw a straight vertical line from the parent's bottom center to the child's top center
        const pathData = `M ${parentPCP.x},${parentPCP.y} 
                          L ${childTCP.x},${childTCP.y}`;

        lineElements.push(
          <path
            key={`line-${node.id}`}
            d={pathData}
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
