'use client';

import { ConceptNode } from '@/app/Definitions/Definitions';
import { useTreeSizeContext } from '@/app/Component/context/TreeSizeContext';

// Function to calculate tree layout using the Reingold-Tilford algorithm
export function reingoldTilfordLayout(nodes: ConceptNode[], rootId: string): ConceptNode[] {
  // Use the context to store the final computed values
  const { setMinX, setMaxX, setMinY, setMaxY, setTreeWidth, setTreeHeight } = useTreeSizeContext();

  const rootNode = nodes.find(node => node.id === rootId);
  if (!rootNode) return nodes;
  if (nodes.length <= 1) return nodes; // The Root node inital position is defined

  const initialRootX = rootNode.x;
  const initialRootY = rootNode.y;

  // Initialize local min/max values with the root's initial position
  let minX = rootNode.x;
  let maxX = rootNode.x;
  let minY = rootNode.y;
  let maxY = rootNode.y;

  // First and second walks to compute node positions
  firstWalk(rootNode, 0, nodes, { minX, maxX, minY, maxY });
  secondWalk(rootNode, 0, nodes, { minX, maxX, minY, maxY });

  const offsetX = initialRootX - rootNode.x;
  const offsetY = initialRootY - rootNode.y;

  nodes.forEach((node) => {
    node.x += offsetX;
    node.y += offsetY;

    // Update local min/max values after shifting nodes
    if (node.x < minX) minX = node.x;
    if (node.x > maxX) maxX = node.x;
    if (node.y < minY) minY = node.y;
    if (node.y > maxY) maxY = node.y;
  });

  // Calculate the width and height of the tree
  const treeWidth = maxX - minX;
  const treeHeight = maxY - minY;

  // Store the final computed values in the context
  setMinX(minX);
  setMaxX(maxX);
  setMinY(minY);
  setMaxY(maxY);
  setTreeWidth(treeWidth);
  setTreeHeight(treeHeight);

  return nodes;
}

// First pass: Assign initial X coordinates and calculate modification offsets
function firstWalk(node: ConceptNode, depth: number, nodes: ConceptNode[], bounds: { minX: number, maxX: number, minY: number, maxY: number }) {
  const children = node.childrenNodeIds?.map(id => nodes.find(n => n.id === id)).filter(Boolean) as ConceptNode[];

  const LEVEL_HEIGHT = 250; // Fixed vertical distance between levels
  const MINIMUM_HORIZONTAL_SPACING = 250; // Minimum horizontal distance between sibling nodes

  // Set vertical position based on depth
  node.y = depth * LEVEL_HEIGHT;
  node.mod = 0; // Initialize mod value

  // Update local minY and maxY after setting the y position
  if (node.y < bounds.minY) bounds.minY = node.y;
  if (node.y > bounds.maxY) bounds.maxY = node.y;

  if (children.length > 0) {
    children.forEach(child => firstWalk(child, depth + 1, nodes, bounds));

    const leftChild = children[0];
    const rightChild = children[children.length - 1];
    const midPoint = (leftChild.x + rightChild.x) / 2;

    // Set the X position of the current node based on its children's midpoint
    node.x = midPoint;

    // Update local minX and maxX after setting the x position
    if (node.x < bounds.minX) bounds.minX = node.x;
    if (node.x > bounds.maxX) bounds.maxX = node.x;

    // Ensure minimum spacing between siblings
    let shift = 0;
    for (let i = 1; i < children.length; i++) {
      const child = children[i];
      const sibling = children[i - 1];
      const distance = child.x - sibling.x;

      if (distance < MINIMUM_HORIZONTAL_SPACING) {
        shift = MINIMUM_HORIZONTAL_SPACING - distance;
        child.x += shift;
        child.mod = (child.mod || 0) + shift;
      }
    }

    // Adjust parent's x position based on the children's spread
    const actualMidPoint = (children[0].x + children[children.length - 1].x) / 2;
    node.x = actualMidPoint;

    // Update local minX and maxX again after final adjustment
    if (node.x < bounds.minX) bounds.minX = node.x;
    if (node.x > bounds.maxX) bounds.maxX = node.x;
  }
}

// Second pass: Apply modifications and compute final positions
function secondWalk(node: ConceptNode, modSum: number, nodes: ConceptNode[], bounds: { minX: number, maxX: number, minY: number, maxY: number }) {
  node.x += modSum; // Apply horizontal modifications

  // Update local minX and maxX after applying modifications
  if (node.x < bounds.minX) bounds.minX = node.x;
  if (node.x > bounds.maxX) bounds.maxX = node.x;

  const children = node.childrenNodeIds?.map(id => nodes.find(n => n.id === id)).filter(Boolean) as ConceptNode[];
  children.forEach(child => secondWalk(child, modSum + (node.mod ?? 0), nodes, bounds));
}
