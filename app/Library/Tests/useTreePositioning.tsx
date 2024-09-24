import { useEffect, useState } from 'react';
import { useSubTreeContext } from '@/app/Library/Tests/SubTreeProvider';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';

export function useTreePositioning(mapRef: React.RefObject<HTMLDivElement>) {
    const [offset, setOffset] = useState<number | null>(null);
    const { subtrees } = useSubTreeContext();
    const { state } = useDocumentContext();
    const { nodes } = state;
  
    useEffect(() => {
      if (!mapRef.current) return;
  
      const nodeWidth = 325; // Adjust according to actual node width
      const rootNode = Array.from(nodes.values()).find(node => node.isRoot);
      if (!rootNode || rootNode.x === undefined || rootNode.y === undefined) return;
  
      // Determine if we should center the tree
      const depthOneNodeCount = rootNode.childrenNodeIds?.length || 0;
      const isSmallTree = depthOneNodeCount < 3; // Adjust threshold as needed
  
      if (isSmallTree) {
        // Center the tree by setting offset to null
        setOffset(null);
      } else {
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
  
        // Desired padding from the left edge
        const desiredLeftPadding = 400; // Adjust as needed
  
        // Calculate offset to position the tree with the leftmost edge at desired padding
        const offsetX = desiredLeftPadding - minLeft;
  
        setOffset(offsetX);
      }
    }, [subtrees, nodes, mapRef]);
  
    return { offset };
  }