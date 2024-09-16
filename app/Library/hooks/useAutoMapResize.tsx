// bloom-maps/app/Library/hooks/useAutoMapResize.tsx

import { useEffect } from 'react';
import { useTreeDimensions } from '@/app/Library/Context/TreeDimensionsProvider';

export function useAutoMapResize(mapRef: React.RefObject<HTMLDivElement>) {
  const { minX, maxX, minY, maxY } = useTreeDimensions();

  useEffect(() => {
    if (!mapRef.current) return;

    // Get the current map dimensions
    const currentMapWidth = parseInt(mapRef.current.style.width, 10) || 0;
    const currentMapHeight = parseInt(mapRef.current.style.height, 10) || 0;

    // Calculate the tree dimensions with padding
    const treeWidth = maxX - minX + 200; // 
    const treeHeight = maxY - minY + 200; // Add padding 

    // Determine the threshold for resizing
    const resizeThreshold = 0.9; // 90% of current map size
    const shouldResizeWidth = treeWidth > resizeThreshold * currentMapWidth;
    const shouldResizeHeight = treeHeight > resizeThreshold * currentMapHeight;

    // Resize the map if necessary
    if (shouldResizeWidth || shouldResizeHeight) {
      if (shouldResizeWidth) {
        mapRef.current.style.width = `${treeWidth + 200}px`; // Update the map's width
      }
      if (shouldResizeHeight) {
        mapRef.current.style.height = `${treeHeight+ 200}px`; // Update the map's height
      }
    }
  }, [minX, maxX, minY, maxY, mapRef]);
}

//use less arbitrary padding here