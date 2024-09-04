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

function firstWalk(node: ConceptNode, depth: number, nodes: ConceptNode[]) {
  const children = node.childrenNodeIds?.map(id => nodes.find(n => n.id === id)).filter(Boolean) as ConceptNode[];

  const LEVEL_HEIGHT = 250; // Increase level height to provide more space between nodes

  node.y = depth * LEVEL_HEIGHT; // Updated: Y-position only based on depth
  node.mod = 0; // Initialize mod value

  if (children.length > 0) {
    children.forEach(child => firstWalk(child, depth + 1, nodes));

    const leftChild = children[0];
    const rightChild = children[children.length - 1];
    const midPoint = (leftChild.x + rightChild.x) / 2;

    node.x = midPoint;

    let shift = 0;
    for (let i = 1; i < children.length; i++) {
      const child = children[i];
      const sibling = children[i - 1];
      const distance = child.x - sibling.x;

      if (distance < 100) {
        shift += 100 - distance;
        child.x += shift;
        child.mod = (child.mod || 0) + shift;
      }
    }
  }
}

function secondWalk(node: ConceptNode, modSum: number, nodes: ConceptNode[]) {
  node.x += modSum;
  const children = node.childrenNodeIds?.map(id => nodes.find(n => n.id === id)).filter(Boolean) as ConceptNode[];
  children.forEach(child => secondWalk(child, modSum + (node.mod ?? 0), nodes));
}
