'use client';

import React from 'react';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';

export function drawConnections(nodes: Map<string, ConceptNode>, color: string = 'black'): JSX.Element[] {
  const connections: JSX.Element[] = [];

  nodes.forEach((node) => {
    if (!node.childrenNodeIds || node.childrenNodeIds.length === 0) return;

    const parentX = node.x + 100; // Calculate center x-coordinate of parent node
    const parentY = node.y + 75;  // Calculate center y-coordinate of parent node

    node.childrenNodeIds.forEach((childId) => {
      const childNode = nodes.get(childId);
      if (!childNode) return;

      const childX = childNode.x + 100; // Center x-coordinate of child node
      const childY = childNode.y;       // Top y-coordinate of child node

      // Draw line from parent to child
      connections.push(
        <line
          key={`line-${node.id}-${childId}`}
          x1={parentX}
          y1={parentY}
          x2={childX}
          y2={childY}
          stroke={color}
          strokeWidth={2}
        />
      );
    });
  });

  return connections;
}
