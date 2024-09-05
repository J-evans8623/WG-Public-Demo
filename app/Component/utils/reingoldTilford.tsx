'use client';

import { ConceptNode } from '@/app/Definitions/Definitions';
import { useTreeSizeContext } from '@/app/Component/context/TreeSizeContext';

export function reingoldTilfordLayout(nodes: ConceptNode[], rootId: string): { laidOutNodes: ConceptNode[], minX: number, maxX: number, minY: number, maxY: number } {
  const treeSizeContext = useTreeSizeContext();
  const rootNode = nodes.find(node => node.id === rootId);
  if (!rootNode) return { laidOutNodes: nodes, minX: 0, maxX: 0, minY: 0, maxY: 0 };

  const initialRootX = rootNode.x;
  const initialRootY = rootNode.y;

  let minX = initialRootX;
  let maxX = initialRootX;
  let minY = initialRootY;
  let maxY = initialRootY;

  firstWalk(rootNode, 0, nodes, minX, maxX, minY, maxY);
  secondWalk(rootNode, 0, nodes, minX, maxX, minY, maxY);

  const offsetX = initialRootX - rootNode.x;
  const offsetY = initialRootY - rootNode.y;

  nodes.forEach((node) => {
    node.x += offsetX;
    node.y += offsetY;
  });

  return { laidOutNodes: nodes, minX, maxX, minY, maxY };
}

function firstWalk(node: ConceptNode, depth: number, nodes: ConceptNode[], minX: number, maxX: number, minY: number, maxY: number) {
  const children = node.childrenNodeIds?.map(id => nodes.find(n => n.id === id)).filter(Boolean) as ConceptNode[];

  const LEVEL_HEIGHT = 250;
  const MINIMUM_HORIZONTAL_SPACING = 250;

  node.y = depth * LEVEL_HEIGHT;
  node.mod = 0;

  minY = Math.min(minY, node.y);
  maxY = Math.max(maxY, node.y);

  if (children.length > 0) {
    children.forEach(child => firstWalk(child, depth + 1, nodes, minX, maxX, minY, maxY));

    const leftChild = children[0];
    const rightChild = children[children.length - 1];
    const midPoint = (leftChild.x + rightChild.x) / 2;

    node.x = midPoint;

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

    const actualMidPoint = (children[0].x + children[children.length - 1].x) / 2;
    node.x = actualMidPoint;
  }

  minX = Math.min(minX, node.x);
  maxX = Math.max(maxX, node.x);
}

function secondWalk(node: ConceptNode, modSum: number, nodes: ConceptNode[], minX: number, maxX: number, minY: number, maxY: number) {
  node.x += modSum;
  const children = node.childrenNodeIds?.map(id => nodes.find(n => n.id === id)).filter(Boolean) as ConceptNode[];

  minX = Math.min(minX, node.x);
  maxX = Math.max(maxX, node.x);

  children.forEach(child => secondWalk(child, modSum + (node.mod ?? 0), nodes, minX, maxX, minY, maxY));
}
