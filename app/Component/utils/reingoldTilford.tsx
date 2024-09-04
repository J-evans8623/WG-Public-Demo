// bloom-maps/app/Component/utils/reingoldTilford.tsx

'use client';

import { ConceptNode } from '@/app/Definitions/Definitions';

// Function to calculate tree layout using the Reingold-Tilford algorithm
export function reingoldTilfordLayout(nodes: ConceptNode[], rootId: string): ConceptNode[] {
  const rootNode = nodes.find(node => node.id === rootId);
  if (!rootNode) return nodes;

  const initialRootX = rootNode.x;
  const initialRootY = rootNode.y;

  firstWalk(rootNode, 0, nodes);
  secondWalk(rootNode, 0, nodes);

  const offsetX = initialRootX - rootNode.x;
  const offsetY = initialRootY - rootNode.y;

  nodes.forEach((node) => {
    node.x += offsetX;
    node.y += offsetY;
  });

  return nodes;
}

// First pass: Assign initial X coordinates and calculate modification offsets
function firstWalk(node: ConceptNode, depth: number, nodes: ConceptNode[]) {
  const children = node.childrenNodeIds?.map(id => nodes.find(n => n.id === id)).filter(Boolean) as ConceptNode[];

  const LEVEL_HEIGHT = 250; // Fixed vertical distance between levels
  const MINIMUM_HORIZONTAL_SPACING = 250; // Minimum horizontal distance between sibling nodes

  // Set vertical position based on depth
  node.y = depth * LEVEL_HEIGHT;
  node.mod = 0; // Initialize mod value

  if (children.length > 0) {
    children.forEach(child => firstWalk(child, depth + 1, nodes));

    const leftChild = children[0];
    const rightChild = children[children.length - 1];
    const midPoint = (leftChild.x + rightChild.x) / 2;

    // Set the X position of the current node based on its children's midpoint
    node.x = midPoint;

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
  }
}

// Second pass: Apply modifications and compute final positions
function secondWalk(node: ConceptNode, modSum: number, nodes: ConceptNode[]) {
  node.x += modSum; // Apply horizontal modifications
  const children = node.childrenNodeIds?.map(id => nodes.find(n => n.id === id)).filter(Boolean) as ConceptNode[];
  children.forEach(child => secondWalk(child, modSum + (node.mod ?? 0), nodes));
}
