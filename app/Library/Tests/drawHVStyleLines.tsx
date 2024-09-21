// bloom-maps/app/Library/utils/drawHVStyleLines.tsx

import React from 'react';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';

export function drawHVStyleLines(
  nodes: Map<string, ConceptNode>,
  lineWidth: number,
  strokeColor: string = '#6e6e6e'
): JSX.Element[] {
  const lineElements: JSX.Element[] = [];

  // Define default width and height of nodes
  const nodeWidth = 325;
  const nodeHeight = 125;

  const rootNode = Array.from(nodes.values()).find((node) => node.isRoot);
  if (!rootNode || rootNode.x === undefined || rootNode.y === undefined) return lineElements;

  const depthOneNodes = Array.from(nodes.values()).filter((node) => node.depth === 1);

  depthOneNodes.forEach((node) => {
    if (node.x !== undefined && node.y !== undefined) {
      const startX = (rootNode.x ?? 0) + nodeWidth / 2;
      const startY = (rootNode.y ?? 0) + nodeHeight;

      const endX = node.x + nodeWidth / 2;
      const endY = node.y;

      lineElements.push(
        <line
          key={`line-root-to-subtree-${node.id}`}
          x1={startX}
          y1={startY}
          x2={endX}
          y2={endY}
          stroke={strokeColor}
          strokeWidth={lineWidth}
        />
      );
    }
  });

  return lineElements;
}
