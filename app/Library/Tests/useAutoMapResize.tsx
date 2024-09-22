import { useEffect } from 'react';
import { useSubTreeContext } from '@/app/Library/Tests/SubTreeProvider';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';

export function useAutoMapResize(mapRef: React.RefObject<HTMLDivElement>) {
  const { subtrees } = useSubTreeContext();
  const { state } = useDocumentContext();
  const { nodes } = state;

  useEffect(() => {
    if (!mapRef.current) return;

    const currentMapWidth = parseInt(mapRef.current.style.width, 10) || 0;
    const currentMapHeight = parseInt(mapRef.current.style.height, 10) || 0;

    // Get root node dimensions and position
    const nodeWidth = 325; // Adjust as per your actual node width
    const nodeHeight = 125; // Adjust as per your actual node height

    const rootNode = Array.from(nodes.values()).find(node => node.isRoot);

    let minLeft = Infinity;
    let maxRight = -Infinity;
    let maxSubtreeHeight = 0;

    // Include root node in calculations
    if (rootNode && rootNode.x !== undefined && rootNode.y !== undefined) {
      const rootLeft = rootNode.x;
      const rootRight = rootNode.x + nodeWidth;

      minLeft = Math.min(minLeft, rootLeft);
      maxRight = Math.max(maxRight, rootRight);
    }

    // Iterate over subtrees
    subtrees.forEach(subtree => {
      const leftEdge = subtree.position.x;
      const rightEdge = subtree.position.x + subtree.width + nodeWidth;

      minLeft = Math.min(minLeft, leftEdge);
      maxRight = Math.max(maxRight, rightEdge);

      // Update max subtree height
      if (subtree.height + subtree.position.y > maxSubtreeHeight) {
        maxSubtreeHeight = subtree.height + subtree.position.y;
      }
    });

    // Calculate total width and height
    const totalWidthSpan = maxRight - minLeft;
    const totalHeight = maxSubtreeHeight + nodeHeight; // Include root node height

    // Add padding
    const paddingWidth = 875; // Adjust as needed
    const paddingHeight = 875; // Adjust as needed

    const treeWidth = totalWidthSpan// + paddingWidth;
    const treeHeight = totalHeight// + paddingHeight;

    const resizeThreshold = 0.8; // 80% of current map size

    const shouldResizeWidth = treeWidth  > (currentMapWidth * resizeThreshold ) ;
    const shouldResizeHeight = treeHeight > (currentMapHeight * resizeThreshold);

    if (shouldResizeWidth || shouldResizeHeight) {
      const updateWidth = Math.max(currentMapWidth, treeWidth) + paddingWidth;
      const updateHeight = Math.max(currentMapHeight, treeHeight) + paddingHeight;

      if (shouldResizeWidth) {
        mapRef.current.style.width = `${updateWidth}px`;
      }
      if (shouldResizeHeight) {
        mapRef.current.style.height = `${updateHeight}px`;
      }
    }
  }, [subtrees, nodes, mapRef]);
}
