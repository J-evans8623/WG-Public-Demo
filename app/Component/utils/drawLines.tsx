// bloom-maps/app/Component/utils/drawLines.tsx

'use client';

import React from 'react';
import { ConceptNode } from '@/app/Definitions/Definitions';

export function drawLines(nodes: ConceptNode[]): JSX.Element[] { // Explicitly define the return type
  const lines: JSX.Element[] = []; // Explicitly declare the type of 'lines'

  nodes.forEach((node) => {
    if (!node.childrenNodeIds) return;

    node.childrenNodeIds.forEach((childId) => {
      const childNode = nodes.find((n) => n.id === childId);
      if (!childNode) return;

      // Create a line between the parent node and each child node
      lines.push(
        <line
          key={`${node.id}-${childId}`}
          x1={node.x}
          y1={node.y}
          x2={childNode.x}
          y2={childNode.y}
          stroke="black"
          strokeWidth={2}
        />
      );
    });
  });

  return lines; // Return the array of lines to be rendered
}
