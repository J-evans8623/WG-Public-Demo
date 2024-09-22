import React from 'react';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { SubtreeData } from '@/app/Library/Tests/SubTreeProvider';

export function drawHVStyleLines(
  nodes: Map<string, ConceptNode>,
  subtrees: Map<string, SubtreeData>,
  lineWidth: number,
  strokeColor: string = '#6e6e6e' // Default gray color
): JSX.Element[] {
  const lineElements: JSX.Element[] = [];

  // Define default width and height of nodes
  const nodeWidth = 325;
  const nodeHeight = 125;

  // Get the root node
  const rootNode = Array.from(nodes.values()).find(node => node.isRoot);

  if (!rootNode || rootNode.x === undefined || rootNode.y === undefined) return lineElements;

  // Calculate the center bottom point of the root node
  const rootPCP = { x: rootNode.x + nodeWidth / 2, y: rootNode.y + nodeHeight };

  // If there are no subtrees, return
  if (subtrees.size === 0) return lineElements;

  if (subtrees.size === 1) {
    // Only one subtree
    const [nodeId, subtreeData] = subtrees.entries().next().value;

    const childCCP = {
      x: subtreeData.position.x + nodeWidth / 2,
      y: subtreeData.position.y,
    };

    lineElements.push(
      <path
        key={`curve-root-to-single-child`}
        d={`M ${rootPCP.x},${rootPCP.y} Q ${rootPCP.x},${(rootPCP.y + childCCP.y) / 2} ${childCCP.x},${childCCP.y}`}
        stroke={strokeColor}
        strokeWidth={lineWidth}
        fill="none"
      />
    );
  } else {
    // Multiple subtrees
    let leftmostX = Infinity;
    let rightmostX = -Infinity;

    subtrees.forEach((subtreeData) => {
      const x = subtreeData.position.x + nodeWidth / 2;
      if (x < leftmostX) leftmostX = x;
      if (x > rightmostX) rightmostX = x;
    });

    const anchorY = rootPCP.y + 50;

    // Draw horizontal anchor line
    lineElements.push(
      <path
        key="curved-anchor-line-depth1"
        d={`M ${leftmostX},${anchorY} L ${rightmostX},${anchorY}`}
        stroke={strokeColor}
        strokeWidth={lineWidth}
        fill="none"
      />
    );

    // Draw path from root to anchor
    lineElements.push(
      <path
        key={`curve-root-to-anchor`}
        d={`M ${rootPCP.x},${rootPCP.y} Q ${rootPCP.x},${anchorY - 25} ${rootPCP.x},${anchorY}`}
        stroke={strokeColor}
        strokeWidth={lineWidth}
        fill="none"
      />
    );

    // Draw paths from anchor to each subtree
    subtrees.forEach((subtreeData, nodeId) => {
      const x = subtreeData.position.x + nodeWidth / 2;
      const y = subtreeData.position.y;
      const controlY = anchorY + 10;

      lineElements.push(
        <path
          key={`curve-anchor-to-ccp-${nodeId}`}
          d={`M ${x},${anchorY} Q ${x},${controlY} ${x},${y}`}
          stroke={strokeColor}
          strokeWidth={lineWidth}
          fill="none"
        />
      );
    });
  }

  return lineElements;
}
