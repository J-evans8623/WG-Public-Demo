import { useEffect, useState } from 'react';
import { useSubTreeContext } from '@/app/Library/Tests/SubTreeProvider';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';

export function useTreePositioning(mapRef: React.RefObject<HTMLDivElement>) {
  const [offset, setOffset] = useState(0);
  const { subtrees } = useSubTreeContext();
  const { state } = useDocumentContext();
  const { nodes } = state;

  useEffect(() => {
    if (!mapRef.current) return;

    const nodeWidth = 325; // Adjust according to actual node width
    const rootNode = Array.from(nodes.values()).find(node => node.isRoot);
    if (!rootNode || rootNode.x === undefined || rootNode.y === undefined) return;

    let minLeft = rootNode.x;
    let maxRight = rootNode.x + nodeWidth;

    // Include subtrees in calculations
    subtrees.forEach((subtree) => {
      const leftEdge = subtree.position.x;
      const rightEdge = subtree.position.x + subtree.width;
      minLeft = Math.min(minLeft, leftEdge);
      maxRight = Math.max(maxRight, rightEdge);
    });

    const totalTreeWidth = maxRight - minLeft;

    // Get map dimensions
    const mapWidth = mapRef.current.offsetWidth;

    // Calculate offset to center the tree within the map
    const offsetX = (mapWidth - totalTreeWidth) / 2 - minLeft;

    setOffset(offsetX);
  }, [subtrees, nodes, mapRef]);

  return { offset };
}
