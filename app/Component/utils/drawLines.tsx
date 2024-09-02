// bloom-maps/app/Component/utils/drawLines.tsx

'use client';

import React from 'react';
import { ConceptNode as ConceptNodeType } from '@/app/Definitions/Definitions';

export function drawLines(nodes: ConceptNodeType[]): JSX.Element[] {
  const lines: JSX.Element[] = [];

  nodes.forEach((node) => {
    if (!node.childrenNodeIds) return;

    node.childrenNodeIds.forEach((childId) => {
      const childNode = nodes.find((n) => n.id === childId);
      if (!childNode) return;

      const x1 = node.x;
      const y1 = node.y;
      const x2 = childNode.x;
      const y2 = childNode.y;

      lines.push(
        <line
          key={`${node.id}-${childId}`}
          x1={x1 + 100} // Adjust for node width offset
          y1={y1 + 75}  // Adjust for node height offset
          x2={x2 + 100}
          y2={y2 + 75}
          stroke="black"
          strokeWidth={2}
        />
      );
    });
  });

  return lines;
}