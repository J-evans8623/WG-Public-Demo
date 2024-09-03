// bloom-maps/app/Component/utils/reingoldTilford.tsx

'use client';

import { ConceptNode } from '@/app/Definitions/Definitions';

// Function to calculate tree layout using the Reingold-Tilford algorithm
export function reingoldTilfordLayout(nodes: ConceptNode[], rootId: string): ConceptNode[] {
  // Find the root node
  const rootNode = nodes.find(node => node.id === rootId);
  if (!rootNode) return nodes;

  // Store the initial position of the root node
  const initialRootX = rootNode.x;
  const initialRootY = rootNode.y;

  // Initialize the tree with the root node
  firstWalk(rootNode, 0, nodes);
  secondWalk(rootNode, 0, nodes);

  // Apply offsets to maintain the root node's initial position
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

  if (children.length === 0) {
    // Leaf node: Position based on its depth
    node.x = 0;
    node.y = depth * 300; // Updated: Increase vertical distance between levels (200px)
    node.mod = 0; // Ensure mod is initialized
  } else {
    // Internal node: Process children first
    children.forEach(child => firstWalk(child, depth + 1, nodes));

    // Calculate initial positions based on children's positions
    const leftChild = children[0];
    const rightChild = children[children.length - 1];
    const midPoint = (leftChild.x + rightChild.x) / 2;

    // Set the node position relative to its parent
    node.x = midPoint;
    node.y = depth * 200; // Updated: Increase vertical distance between levels (200px)
    node.mod = 0; // Ensure mod is initialized

    // Ensure no overlapping between subtrees
    let shift = 0;
    for (let i = 1; i < children.length; i++) {
      const child = children[i];
      const sibling = children[i - 1];
      const distance = child.x - sibling.x;

      if (distance < 100) { // Minimum spacing between sibling nodes
        shift += 100 - distance;
        child.x += shift;
        child.mod = (child.mod || 0) + shift; // Ensure mod is always defined
      }
    }
  }
}

// Second pass: Apply modifications and compute final positions
function secondWalk(node: ConceptNode, modSum: number, nodes: ConceptNode[]) {
  node.x += modSum;
  const children = node.childrenNodeIds?.map(id => nodes.find(n => n.id === id)).filter(Boolean) as ConceptNode[];
  children.forEach(child => secondWalk(child, modSum + (node.mod ?? 0), nodes));
}
