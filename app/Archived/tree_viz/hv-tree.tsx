'use client';

import { ConceptNode } from '@/app/Archived/Definitions/Definitions';

// HV Tree Layout Algorithm
export function hvTreeLayout(nodes: ConceptNode[], rootId: string): ConceptNode[] {
  // Find the root node
  const rootNode = nodes.find((node) => node.id === rootId);
  if (!rootNode) return nodes;
  if (nodes.length <= 1) return nodes; // Only one node in the tree

  // Set initial positions for the root node
  const initialRootX = rootNode.x;
  const initialRootY = rootNode.y;

  // Define constants for the layout
  const LEVEL_HEIGHT = 200; // Vertical distance between levels
  const NODE_WIDTH = 200; // Node width
  const MIN_HORIZONTAL_SPACING = 250; // Minimum horizontal spacing between nodes

  // Start positioning from the root node
  positionNodesHV(rootNode, 0, nodes, NODE_WIDTH, MIN_HORIZONTAL_SPACING, LEVEL_HEIGHT);

  // Adjust positions to maintain initial root node position
  const offsetX = initialRootX - rootNode.x;
  const offsetY = initialRootY - rootNode.y;

  nodes.forEach((node) => {
    node.x += offsetX;
    node.y += offsetY;
  });

  return nodes;
}

// Function to position nodes recursively
function positionNodesHV(
  node: ConceptNode,
  depth: number,
  nodes: ConceptNode[],
  nodeWidth: number,
  minSpacing: number,
  levelHeight: number
) {
  // Get the children nodes
  const children = node.childrenNodeIds
    ?.map((id) => nodes.find((n) => n.id === id))
    .filter(Boolean) as ConceptNode[];

  // Set the y position for the current node based on its depth
  node.y = depth * levelHeight;

  if (!children.length) {
    // If no children, this is a leaf node
    node.x = nodeWidth / 2; // Position leaf nodes centered horizontally
    return;
  }

  // Recursively position all children nodes
  children.forEach((child, index) => {
    positionNodesHV(child, depth + 1, nodes, nodeWidth, minSpacing, levelHeight);
  });

  // Calculate the x position for the parent node based on its children
  const leftmostChild = children[0];
  const rightmostChild = children[children.length - 1];
  const midpoint = (leftmostChild.x + rightmostChild.x) / 2;
  node.x = midpoint;

  // Ensure minimum horizontal spacing between sibling nodes
  for (let i = 1; i < children.length; i++) {
    const prevChild = children[i - 1];
    const currChild = children[i];
    const requiredSpacing = minSpacing;
    const actualSpacing = currChild.x - prevChild.x;

    if (actualSpacing < requiredSpacing) {
      const shift = requiredSpacing - actualSpacing;
      currChild.x += shift; // Move current child to the right
    }
  }

  // Update x position of parent node based on children's positions
  const actualMidPoint = (leftmostChild.x + rightmostChild.x) / 2;
  node.x = actualMidPoint;
}
