import React from 'react';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';

export function drawIndentedStyleLines(
  nodes: Map<string, ConceptNode>, 
  lineWidth: number, 
  strokeColor: string = '#6e6e6e' // Default gray color
): JSX.Element[] {
  const lineElements: JSX.Element[] = [];

  const depthGreaterThanOneNodes = Array.from(nodes.values()).filter(node => node.depth > 1);

  depthGreaterThanOneNodes.forEach(node => {
    if (node.parentNodeId) {
      const parentNode = nodes.get(node.parentNodeId);

      if (parentNode && parentNode.x !== undefined && parentNode.y !== undefined) {
        const parentPCP = { x: parentNode.x + 25, y: parentNode.y + 150 };
        const childCCP = { x: node.x ?? 0, y: node.y ? node.y + 75 : 75 };

        lineElements.push(
          <path
            key={`curve-pcp-to-child-${node.id}`}
            d={`M ${parentPCP.x},${parentPCP.y} Q ${parentPCP.x},${(parentPCP.y + childCCP.y) / 2} ${parentPCP.x},${childCCP.y}`}
            stroke={strokeColor}
            strokeWidth={lineWidth}
            fill="none"
          />
        );

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
