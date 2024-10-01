// bloom-maps\app\Library\hooks\useAutoMapResize.tsx
import { useEffect, useCallback, useState } from 'react';
import { useSubTreeContext } from '@/app/Library/Context/SubTreeProvider';
import { useDocumentContext, toggleResetMapSize } from '@/app/Library/Context/DocumentProvider';

export function useAutoMapResize(mapRef: React.RefObject<HTMLDivElement>) {
  const { subtrees } = useSubTreeContext();
  const { state, dispatch } = useDocumentContext();
  const { nodes, defaultMapWidth, defaultMapHeight, resetMapSize } = state;

  const [mapSize, setMapSize] = useState({ width: defaultMapWidth, height: defaultMapHeight });

  // Reset function to set the map size back to its default values
  const resetMapSizeFn = useCallback(() => {
    setMapSize({
      width: defaultMapWidth,
      height: defaultMapHeight,
    });

    if (mapRef.current) {
      mapRef.current.style.width = `${defaultMapWidth}px`;
      mapRef.current.style.height = `${defaultMapHeight}px`;
      console.log(`${defaultMapWidth} by ${defaultMapHeight}`);
    }
    dispatch(toggleResetMapSize());
  }, [defaultMapWidth, defaultMapHeight, mapRef, dispatch]);

  // Automatically resize map based on content (nodes and subtrees)
  useEffect(() => {
    if (!mapRef.current) return;

    const nodeWidth = 325; // Adjust according to actual node width
    const nodeHeight = 125; // Adjust according to actual node height

    const rootNode = Array.from(nodes.values()).find((node) => node.isRoot);
    if (!rootNode || rootNode.x === undefined || rootNode.y === undefined) return;

    let minLeft = rootNode.x;
    let maxRight = rootNode.x + nodeWidth;
    let maxSubtreeHeight = rootNode.y + nodeHeight;

    // Include subtrees in calculations
    subtrees.forEach((subtree) => {
      const leftEdge = subtree.position?.x ?? 0;  // Fallback to 0 if position is undefined
      const rightEdge = (subtree.position?.x ?? 0) + subtree.width;  // Fallback to 0 if position is undefined
      minLeft = Math.min(minLeft, leftEdge);
      maxRight = Math.max(maxRight, rightEdge);

      const subtreeBottom = (subtree.position?.y ?? 0) + subtree.height;  // Fallback to 0 if position is undefined
      if (subtreeBottom > maxSubtreeHeight) {
        maxSubtreeHeight = subtreeBottom;
      }
    });

    // Desired paddings
    const desiredLeftPadding = 400;
    const desiredRightPadding = 400;
    const desiredTopPadding = 200;
    const desiredBottomPadding = 200;

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

    // Update map size if needed
    if (shouldResizeWidth || shouldResizeHeight) {
      const newWidth = Math.max(currentMapWidth, treeWidth);
      const newHeight = Math.max(currentMapHeight, treeHeight);

      setMapSize({
        width: newWidth,
        height: newHeight,
      });

      if (mapRef.current) {
        mapRef.current.style.width = `${newWidth}px`;
        mapRef.current.style.height = `${newHeight}px`;
      }
    }
  }, [subtrees, nodes, mapRef]);

  // Watch for changes to the resetTrigger
  useEffect(() => {
    if (resetMapSize) {
      resetMapSizeFn();
    }
  }, [resetMapSize, resetMapSizeFn]);

  // Initial effect to set the default size when the map is first loaded
  useEffect(() => {
    // Set initial map size on mount
    if (mapRef.current) {
      mapRef.current.style.width = `${defaultMapWidth}px`;
      mapRef.current.style.height = `${defaultMapHeight}px`;
    }
  }, [mapRef, defaultMapWidth, defaultMapHeight]);

  return { resetMapSize: resetMapSizeFn };
}
