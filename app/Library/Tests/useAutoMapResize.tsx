// bloom-maps/app/Library/Tests/useAutoMapResize.tsx

import { useEffect } from 'react';
import { useTreeDimensions } from '@/app/Library/Context/TreeDimensionsProvider';

export function useAutoMapResize(mapRef: React.RefObject<HTMLDivElement>) {
  const { minX, maxX, minY, maxY } = useTreeDimensions();
  useEffect(() => {
    if (!mapRef.current) return;

    const currentMapWidth = parseInt(mapRef.current.style.width, 10) || 0;
    const currentMapHeight = parseInt(mapRef.current.style.height, 10) || 0;

    const treeWidth = maxX - minX + 800; // Add padding
    const treeHeight = maxY - minY + 400; // Add padding

    const resizeThreshold = 0.8; // 80% of current map size

    const shouldResizeWidth = treeWidth > resizeThreshold * currentMapWidth;
    const shouldResizeHeight = treeHeight > resizeThreshold * currentMapHeight;

    if (shouldResizeWidth || shouldResizeHeight) {
      if (shouldResizeWidth) {
        mapRef.current.style.width = `${treeWidth}px`;
      }
      if (shouldResizeHeight) {
        mapRef.current.style.height = `${treeHeight}px`;
      }
    }
  }, [minX, maxX, minY, maxY, mapRef]);
}
