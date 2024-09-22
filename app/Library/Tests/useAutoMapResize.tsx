import { useEffect } from 'react';
import { useSubTreeContext } from '@/app/Library/Tests/SubTreeProvider';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';

export function useAutoMapResize(mapRef: React.RefObject<HTMLDivElement>) {
  const { subtrees } = useSubTreeContext();
  const { state } = useDocumentContext();
  const { nodes } = state;

  useEffect(() => {
    if (!mapRef.current) return;

    const nodeWidth = 325; // Adjust according to actual node width
    const nodeHeight = 125; // Adjust according to actual node height

    const rootNode = Array.from(nodes.values()).find(node => node.isRoot);
    if (!rootNode || rootNode.x === undefined || rootNode.y === undefined) return;

    let minLeft = rootNode.x;
    let maxRight = rootNode.x + nodeWidth;
    let maxSubtreeHeight = rootNode.y + nodeHeight;

    // Include subtrees in calculations
    subtrees.forEach((subtree) => {
      const leftEdge = subtree.position.x;
      const rightEdge = subtree.position.x + subtree.width;
      minLeft = Math.min(minLeft, leftEdge);
      maxRight = Math.max(maxRight, rightEdge);

      // Update max height
      const subtreeBottom = subtree.position.y + subtree.height;
      if (subtreeBottom > maxSubtreeHeight) {
        maxSubtreeHeight = subtreeBottom;
      }
    });

    // Desired paddings
    const desiredLeftPadding = 400; // Should match the padding in useTreePositioning
    const desiredRightPadding = 400; // Adjust as needed
    const desiredTopPadding = 200; // Existing top padding
    const desiredBottomPadding = 200; // Adjust as needed

    // Calculate total width and height
    const totalTreeWidth = maxRight - minLeft;
    const treeWidth = desiredLeftPadding + totalTreeWidth + desiredRightPadding;
    const treeHeight = desiredTopPadding + maxSubtreeHeight + desiredBottomPadding;

    // Get current map dimensions
    const currentMapWidth = mapRef.current.offsetWidth;
    const currentMapHeight = mapRef.current.offsetHeight;

    const resizeThreshold = 0.8; // 80% of current map size

    const shouldResizeWidth = treeWidth > resizeThreshold * currentMapWidth;
    const shouldResizeHeight = treeHeight > resizeThreshold * currentMapHeight;

    if (shouldResizeWidth || shouldResizeHeight) {
      const updateWidth = Math.max(currentMapWidth, treeWidth);
      const updateHeight = Math.max(currentMapHeight, treeHeight);

      if (shouldResizeWidth) {
        mapRef.current.style.width = `${updateWidth}px`;
      }
      if (shouldResizeHeight) {
        mapRef.current.style.height = `${updateHeight}px`;
      }
    }
  }, [subtrees, nodes, mapRef]);
}
