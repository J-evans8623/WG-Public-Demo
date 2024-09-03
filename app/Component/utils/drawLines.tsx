// bloom-maps/app/Component/utils/drawLines.tsx

'use client';

import React from 'react';
import { ConceptNode } from '@/app/Definitions/Definitions';

export function drawLines(nodes: ConceptNode[]): JSX.Element[] {
  const lines: JSX.Element[] = [];

  nodes.forEach((node) => {
    if (!node.childrenNodeIds || node.childrenNodeIds.length === 0) return;

    // Calculate Parent Bottom Center (PBC)
    const PBC_X = node.x + 100; // Assuming each node is 200px wide
    const PBC_Y = node.y + 150; // Y coordinate at the bottom center of the parent node

    // Define a fixed vertical offset for the anchor point
    const ANCHOR_Y = PBC_Y + 100; // Adjust this value to increase or decrease vertical spacing

    node.childrenNodeIds.forEach((childId) => {
      const childNode = nodes.find((n) => n.id === childId);
      if (!childNode) return;

      const childX = childNode.x + 100;  // Child Center X
      const childY = childNode.y;        // Child Top Center Y

      // Draw a vertical line from the parent node to the anchor point
      lines.push(
        <line
          key={`vertical-${node.id}-${childId}`}
          x1={PBC_X}
          y1={PBC_Y}
          x2={PBC_X}
          y2={ANCHOR_Y}
          stroke="black"
          strokeWidth={2}
        />
      );

      // Draw a horizontal line from the anchor point to the child's top center
      lines.push(
        <line
          key={`horizontal-${node.id}-${childId}`}
          x1={PBC_X}
          y1={ANCHOR_Y}
          x2={childX}
          y2={ANCHOR_Y}
          stroke="black"
          strokeWidth={2}
        />
      );

      // Draw a vertical line from the anchor point to the child's top center
      lines.push(
        <line
          key={`vertical-child-${node.id}-${childId}`}
          x1={childX}
          y1={ANCHOR_Y}
          x2={childX}
          y2={childY}
          stroke="black"
          strokeWidth={2}
        />
      );
    });
  });

  return lines;
}
