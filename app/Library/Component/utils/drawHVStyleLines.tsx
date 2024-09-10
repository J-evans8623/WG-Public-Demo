// drawHVStyleLines.tsx

import React from 'react';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';

export function drawHVStyleLines(nodes: Map<string, ConceptNode>, lineWidth: number): JSX.Element[] {
  const lineElements: JSX.Element[] = [];

  // Get the root node and its children at depth 1
  const depthOneNodes = Array.from(nodes.values()).filter(node => node.depth === 1);

  if (depthOneNodes.length === 0) return lineElements;

  const rootNode = Array.from(nodes.values()).find(node => node.isRoot);

  if (!rootNode || rootNode.x === undefined || rootNode.y === undefined) return lineElements;

  // Calculate the Parent Connection Point (PCP) for the root node
  const rootPCP = { x: rootNode.x + 100, y: rootNode.y + 150 }; // Midpoint bottom of the root node

  if (depthOneNodes.length === 1) {
    // Case with only one child at depth 1
    const singleChild = depthOneNodes[0];

    if (singleChild.x !== undefined && singleChild.y !== undefined) {
      const childCCP = { x: singleChild.x + 100, y: singleChild.y }; // Midpoint top of the single child node

      // Draw a single line from PCP of the root to CCP of the child
      lineElements.push(
        <line
          key={`line-root-to-single-child`}
          x1={rootPCP.x}
          y1={rootPCP.y}
          x2={childCCP.x}
          y2={childCCP.y}
          stroke="black"
          strokeWidth={lineWidth} // Use centralized line width
        />
      );
    }
  } else {
    // General case with multiple children at depth 1

    // Calculate the leftmost and rightmost CCPs of child nodes
    const leftmostNode = depthOneNodes.reduce((minNode, currentNode) =>
      currentNode.x !== undefined && (minNode.x === undefined || currentNode.x < minNode.x)
        ? currentNode
        : minNode
    );

    const rightmostNode = depthOneNodes.reduce((maxNode, currentNode) =>
      currentNode.x !== undefined && (maxNode.x === undefined || currentNode.x > maxNode.x)
        ? currentNode
        : maxNode
    );

    const leftmostX = (leftmostNode.x ?? 0) + 100; // CCP of leftmost node
    const rightmostX = (rightmostNode.x ?? 0) + 100; // CCP of rightmost node
    const anchorY = rootPCP.y + 50; // 50px below the root node's bottom

    // Draw the horizontal anchor line from the leftmost to the rightmost CCPs
    lineElements.push(
      <line
        key="anchor-line-depth1"
        x1={leftmostX}
        y1={anchorY}
        x2={rightmostX}
        y2={anchorY}
        stroke="black"
        strokeWidth={lineWidth} // Use centralized line width
      />
    );

    // Draw lines connecting from the PCP of the root node to the anchor line
    lineElements.push(
      <line
        key={`line-root-to-anchor`}
        x1={rootPCP.x}
        y1={rootPCP.y}
        x2={rootPCP.x}
        y2={anchorY}
        stroke="black"
        strokeWidth={lineWidth} // Use centralized line width
      />
    );

    // Draw lines from each child node's CCP to the anchor line
    depthOneNodes.forEach(node => {
      if (node.x !== undefined && node.y !== undefined) {
        const childCCP = { x: node.x + 100, y: node.y }; // Midpoint top of each child node
        lineElements.push(
          <line
            key={`line-ccp-to-anchor-${node.id}`}
            x1={childCCP.x}
            y1={childCCP.y}
            x2={childCCP.x}
            y2={anchorY}
            stroke="black"
            strokeWidth={lineWidth} // Use centralized line width
          />
        );
      }
    });
  }

  return lineElements;
}
