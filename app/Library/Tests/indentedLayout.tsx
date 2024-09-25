import { ConceptNode } from '@/app/Library/Definitions/Definitions';

interface SubtreeDimension {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export function applyIndentedLayout(
  nodes: Map<string, ConceptNode>,
  rootNodeId: string
): { updatedNodes: Map<string, ConceptNode>; subtreeDimension: SubtreeDimension } {
  const updatedNodes = new Map(nodes);

  const indentationWidth = 90;
  const verticalSpacing = 175;

  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;

  const positionNodeAndChildren = (
    node: ConceptNode,
    parentX: number,
    currentY: number
  ): number => {
    node.x = parentX + indentationWidth;
    node.y = currentY;
    updatedNodes.set(node.id, node);

    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);

    let nextY = currentY + verticalSpacing;

    const children = node.childrenNodeIds
      ?.map((id) => nodes.get(id))
      .filter(Boolean) as ConceptNode[];

    children.forEach((child) => {
      nextY = positionNodeAndChildren(child, node.x ?? 0, nextY);
    });

    return nextY;
  };

  const rootNode = nodes.get(rootNodeId);
  if (rootNode) {
    rootNode.x = 0; // root debug root
    rootNode.y = 0;
    updatedNodes.set(rootNode.id, rootNode);

    minX = 0;
    maxX = 0;
    minY = 0;
    maxY = 0;

    let currentY = 0;

    const children = rootNode.childrenNodeIds
      ?.map((id) => nodes.get(id))
      .filter(Boolean) as ConceptNode[];

      children.forEach((child, index) => {
        currentY = positionNodeAndChildren(child, rootNode.x ?? 0, currentY + (index === 0 ? verticalSpacing : 0));// here
    });
  }

  const subtreeWidth = maxX - minX + 325;
  const subtreeHeight = maxY - minY + 125;

  const subtreeDimension: SubtreeDimension = {
    minX,
    maxX,
    minY,
    maxY,
    width: subtreeWidth,
    height: subtreeHeight,
  };

  return { updatedNodes, subtreeDimension };
}
