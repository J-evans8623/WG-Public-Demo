// bloom-maps/app/Library/Tests/drawRightAngleLinesWithAnchor.tsx
import React from 'react';
import { ConceptNode } from '@/app/Library/Definitions/Definitions';
import { SubtreeData } from '@/app/Library/Tests/SubTreeProvider';

export function drawRightAngleLinesWithAnchor(
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

  let leftmostX = Infinity;
  let rightmostX = -Infinity;

  // Find the exact connection points for the leftmost and rightmost subtrees
  subtrees.forEach((subtreeData) => {
    const x = subtreeData.position.x + nodeWidth / 2;
    if (x < leftmostX) leftmostX = x;
    if (x > rightmostX) rightmostX = x;
  });

  // Define the anchor line's y-coordinate below the root
  const anchorY = rootPCP.y + 50;
  const curveRadius = 50; // Curve radius

  // Draw the horizontal anchor line but stop just before the curves start
  lineElements.push(
    <path
      key="anchor-line"
      d={`M ${leftmostX + curveRadius},${anchorY} L ${rightmostX - curveRadius},${anchorY}`}
      stroke={strokeColor}
      strokeWidth={lineWidth}
      fill="none"
    />
  );

  // Draw the curve from the root to the anchor line
  lineElements.push(
    <path
      key="curve-root-to-anchor"
      d={`M ${rootPCP.x},${rootPCP.y} Q ${rootPCP.x},${anchorY - 25} ${rootPCP.x},${anchorY}`}
      stroke={strokeColor}
      strokeWidth={lineWidth}
      fill="none"
    />
  );

  // Draw right-angle lines with curves from the anchor line to each child node
  subtrees.forEach((subtreeData, nodeId) => {
    const childCCP = {
      x: subtreeData.position.x + nodeWidth / 2,
      y: subtreeData.position.y,
    };

    const horizontalDistance = childCCP.x - rootPCP.x;
    const verticalDistance = childCCP.y - anchorY;

    // Define the effective curve radius based on available distance
    const effectiveCurveRadius = Math.min(curveRadius, Math.abs(horizontalDistance), Math.abs(verticalDistance));

    let pathData = '';

    if (horizontalDistance > 0) {
      // Right side: Create a concave curve
      pathData = `M ${childCCP.x - effectiveCurveRadius},${anchorY} 
                  a ${effectiveCurveRadius},${effectiveCurveRadius} 0 0 1 ${effectiveCurveRadius},${effectiveCurveRadius}
                  V ${childCCP.y}`;
    } else {
      // Left side: Adjust the arc for a concave curve on the left
      pathData = `M ${childCCP.x + effectiveCurveRadius},${anchorY} 
                  a ${effectiveCurveRadius},${effectiveCurveRadius} 0 0 0 -${effectiveCurveRadius},${effectiveCurveRadius}
                  V ${childCCP.y}`;
    }

    // Add the path as an SVG element
    lineElements.push(
      <path
        key={`line-to-child-${nodeId}`}
        d={pathData}
        stroke={strokeColor}
        strokeWidth={lineWidth}
        fill="none"
      />
    );
  });

  return lineElements;
}
