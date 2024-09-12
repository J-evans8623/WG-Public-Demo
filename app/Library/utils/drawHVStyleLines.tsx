// drawHVStyleLines.tsx

import React from 'react';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';

export function drawHVStyleLines(nodes: Map<string, ConceptNode>, lineWidth: number): JSX.Element[] {
  const lineElements: JSX.Element[] = [];
  const strokeColor = '#6e6e6e'; // Dark gray color for the line outline

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

      // Draw a single curved line from PCP of the root to CCP of the child
      lineElements.push(
        <path
          key={`curve-root-to-single-child`}
          d={`M ${rootPCP.x},${rootPCP.y} Q ${rootPCP.x},${(rootPCP.y + childCCP.y) / 2} ${childCCP.x},${childCCP.y}`}
          stroke={strokeColor}
          strokeWidth={lineWidth}
          fill="none"
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
      <path
        key="curved-anchor-line-depth1"
        d={`M ${leftmostX},${anchorY} L ${rightmostX},${anchorY}`}
        stroke={strokeColor}
        strokeWidth={lineWidth}
        fill="none"
      />
    );

    // Draw a curved line from the PCP of the root node to the anchor line
    lineElements.push(
      <path
        key={`curve-root-to-anchor`}
        d={`M ${rootPCP.x},${rootPCP.y} Q ${rootPCP.x},${anchorY - 25} ${rootPCP.x},${anchorY}`}
        stroke={strokeColor}
        strokeWidth={lineWidth}
        fill="none"
      />
    );

    // Draw curved lines from the anchor line into each child node's CCP
    depthOneNodes.forEach(node => {
      if (node.x !== undefined && node.y !== undefined) {
        const childCCP = { x: node.x + 100, y: node.y }; // Midpoint top of each child node
        const controlY = anchorY + 10; // Adjusted control point slightly below the anchor line to create a dip

        lineElements.push(
          <path
            key={`curve-anchor-to-ccp-${node.id}`}
            d={`M ${childCCP.x},${anchorY} Q ${childCCP.x},${controlY} ${childCCP.x},${childCCP.y}`}
            stroke={strokeColor}
            strokeWidth={lineWidth}
            fill="none"
          />
        );
      }
    });
  }

  return lineElements;
}
