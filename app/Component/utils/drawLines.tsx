// bloom-maps/app/Component/utils/drawLines.tsx

'use client';

import React from 'react';
import { ConceptNode } from '@/app/Definitions/Definitions';

export function drawLines(nodes: ConceptNode[]): JSX.Element[] {

    // Constants for layout and spacing
  const VERTICAL_OFFSET = 100; // Vertical distance from parent node to Anchor Point A
  const HORIZONTAL_SPACING = 100; // Horizontal spacing between child nodes
  const CHILD_NODE_WIDTH = 200; // Width of each child node (can be adjusted)
  const PADDING_BETWEEN_CHILDREN = 50; // Padding between children nodes
  const lines: JSX.Element[] = [];
  nodes.forEach((node) => {
    if (!node.childrenNodeIds || node.childrenNodeIds.length === 0) return;

    // Calculate Parent Bottom Center (PBC)
    const PBC_X = node.x + CHILD_NODE_WIDTH / 2;
    const PBC_Y = node.y + CHILD_NODE_WIDTH; // Bottom of the parent node

    // Calculate Anchor Point A
    const A_X = PBC_X;
    const A_Y = PBC_Y + VERTICAL_OFFSET;

    // Draw Vertical Line from Parent to Anchor Point A
    lines.push(
      <line
        key={`vertical-${node.id}`}
        x1={PBC_X}
        y1={PBC_Y}
        x2={A_X}
        y2={A_Y}
        stroke="black"
        strokeWidth={2}
      />
    );

    // Calculate positions for horizontal line and points for children
    const numberOfChildren = node.childrenNodeIds.length;
    const horizontalLineLength = (numberOfChildren - 1) * (HORIZONTAL_SPACING + CHILD_NODE_WIDTH);

    // Draw Horizontal Line at Point A
    lines.push(
      <line
        key={`horizontal-${node.id}`}
        x1={A_X - horizontalLineLength / 2}
        y1={A_Y}
        x2={A_X + horizontalLineLength / 2}
        y2={A_Y}
        stroke="black"
        strokeWidth={2}
      />
    );

    // Draw Vertical Lines to Each Child
    node.childrenNodeIds.forEach((childId, index) => {
      const childNode = nodes.find((n) => n.id === childId);
      if (!childNode) return;

      const childX = A_X - horizontalLineLength / 2 + index * (HORIZONTAL_SPACING + CHILD_NODE_WIDTH);
      const childY = A_Y + VERTICAL_OFFSET;

      lines.push(
        <line
          key={`vertical-child-${node.id}-${childId}`}
          x1={childX + CHILD_NODE_WIDTH / 2}
          y1={A_Y}
          x2={childX + CHILD_NODE_WIDTH / 2}
          y2={childY}
          stroke="black"
          strokeWidth={2}
        />
      );
    });
  });

  return lines;
}