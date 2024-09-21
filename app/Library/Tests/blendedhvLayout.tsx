// bloom-maps/app/Library/Tests/blendedhvLayout.tsx

import { ConceptNode } from '@/app/Library/Definitions/Definitions';

interface SubtreeDimension {
  width: number;
  height: number;
}

export function applyHVLayout(
  nodes: Map<string, ConceptNode>,
  subtreeDimensions: Map<string, SubtreeDimension>
): Map<string, ConceptNode> {
  const updatedNodes = new Map(nodes);

  const verticalOffset = 225;
  const minHorizontalGap = 50;

  // Set root node position to (0, 0)
  const rootNode = Array.from(updatedNodes.values()).find((node) => node.isRoot);
  if (rootNode) {
    rootNode.x = 0;
    rootNode.y = 0;
    updatedNodes.set(rootNode.id, rootNode);
  } else {
    return updatedNodes;
  }

  const depthOneNodes = Array.from(updatedNodes.values()).filter((node) => node.depth === 1);

  let cumulativeLeftWidth = 0;
  let cumulativeRightWidth = 0;

  depthOneNodes.forEach((node, index) => {
    // Get the subtree dimensions
    const subtreeDimension = subtreeDimensions.get(node.id) || { width: 600, height: 600 };
    const subtreeWidth = subtreeDimension.width;

    // Alternate positioning left and right
    const direction = index % 2 === 0 ? 1 : -1;

    if (direction > 0) {
      // Right side
      node.x = cumulativeRightWidth + (index > 0 ? minHorizontalGap : 0);
      cumulativeRightWidth += subtreeWidth + minHorizontalGap;
    } else {
      // Left side
      node.x = - (cumulativeLeftWidth + subtreeWidth + (index > 0 ? minHorizontalGap : 0));
      cumulativeLeftWidth += subtreeWidth + minHorizontalGap;
    }

    node.y = verticalOffset;

    // Since we're positioning subtrees, the depth 1 node positions are relative to their subtrees
    updatedNodes.set(node.id, node);
  });

  return updatedNodes;
}
