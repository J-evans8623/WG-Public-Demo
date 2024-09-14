import React from 'react';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';

export function drawHVStyleLines(
  nodes: Map<string, ConceptNode>, 
  lineWidth: number, 
  strokeColor: string = '#6e6e6e' // Default gray color
): JSX.Element[] {
  const lineElements: JSX.Element[] = [];

  const depthOneNodes = Array.from(nodes.values()).filter(node => node.depth === 1);

  if (depthOneNodes.length === 0) return lineElements;

  const rootNode = Array.from(nodes.values()).find(node => node.isRoot);

  if (!rootNode || rootNode.x === undefined || rootNode.y === undefined) return lineElements;

  const rootPCP = { x: rootNode.x + 100, y: rootNode.y + 150 }; // Midpoint bottom of the root node

  if (depthOneNodes.length === 1) {
    const singleChild = depthOneNodes[0];

    if (singleChild.x !== undefined && singleChild.y !== undefined) {
      const childCCP = { x: singleChild.x + 100, y: singleChild.y }; // Midpoint top of the single child node

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

    const leftmostX = (leftmostNode.x ?? 0) + 100;
    const rightmostX = (rightmostNode.x ?? 0) + 100;
    const anchorY = rootPCP.y + 50;

    lineElements.push(
      <path
        key="curved-anchor-line-depth1"
        d={`M ${leftmostX},${anchorY} L ${rightmostX},${anchorY}`}
        stroke={strokeColor}
        strokeWidth={lineWidth}
        fill="none"
      />
    );

    lineElements.push(
      <path
        key={`curve-root-to-anchor`}
        d={`M ${rootPCP.x},${rootPCP.y} Q ${rootPCP.x},${anchorY - 25} ${rootPCP.x},${anchorY}`}
        stroke={strokeColor}
        strokeWidth={lineWidth}
        fill="none"
      />
    );

    depthOneNodes.forEach(node => {
      if (node.x !== undefined && node.y !== undefined) {
        const childCCP = { x: node.x + 100, y: node.y };
        const controlY = anchorY + 10;

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
