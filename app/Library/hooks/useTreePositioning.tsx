// bloom-maps\app\Library\Tests\hooks\useTreePositioning.tsx

import { useEffect, useState } from 'react';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';

export function useTreePositioning(mapRef: React.RefObject<HTMLDivElement>) {
  const [offset, setOffset] = useState<number>(0);
  const { subtrees } = useSubTreeContext();
  const { nodes } = useNodesContext();

  useEffect(() => {
    if (!mapRef.current) return;

    const nodeWidth = 325;
    const rootNode = Array.from(nodes.values()).find(node => node.isRoot);
    if (!rootNode || rootNode.x === undefined || rootNode.y === undefined) return;

    // Calculate the bounding box of the entire tree (root node + subtrees)
    let minLeft = rootNode.x;
    let maxRight = rootNode.x + nodeWidth;

    // Include subtrees in calculations
    subtrees.forEach((subtree) => {
      const leftEdge = subtree.position?.x ?? 0; 
      const rightEdge =(subtree.position?.x ?? 0) + subtree.width;
      minLeft = Math.min(minLeft, leftEdge);
      maxRight = Math.max(maxRight, rightEdge);
    });

    const totalTreeWidth = maxRight - minLeft;
    const mapWidth = mapRef.current.offsetWidth;

    // Calculate offset to center the tree within the map without moving the root node
    const offsetX = (mapWidth - totalTreeWidth) / 2 - minLeft;

    setOffset((prevOffset) => {
        if (prevOffset !== offsetX) {
          return offsetX;
        }
        return prevOffset;
      });
  }, [subtrees, nodes, mapRef]);

  return { offset };
}
