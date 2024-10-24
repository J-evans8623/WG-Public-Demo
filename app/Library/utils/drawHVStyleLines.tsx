import React from 'react';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { SubtreeData } from '@/app/Library/Context/SubTreeProvider';

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

  // Remove the sentinel node from subtrees before drawing lines
  const filteredSubtrees = new Map(
    Array.from(subtrees.entries()).filter(([nodeId]) => nodeId !== 'sentinel-node')
  );

  // Adjust the base case to ignore the sentinel node
  if (filteredSubtrees.size === 0) return lineElements;

  if (filteredSubtrees.size === 1) {
    // Only one subtree (ignoring the sentinel)
    const [nodeId, subtreeData] = filteredSubtrees.entries().next().value;

    // Fallback to 0 if position is undefined
    const childCCP = {
      x: (subtreeData.position?.x ?? 0) + nodeWidth / 2,
      y: subtreeData.position?.y ?? 0,
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
    // Multiple subtrees (ignoring the sentinel)
    let leftmostX = Infinity;
    let rightmostX = -Infinity;

    filteredSubtrees.forEach((subtreeData) => {
      const x = (subtreeData.position?.x ?? 0) + nodeWidth / 2;
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
    filteredSubtrees.forEach((subtreeData, nodeId) => {
      const x = (subtreeData.position?.x ?? 0) + nodeWidth / 2;
      const y = subtreeData.position?.y ?? 0;
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
