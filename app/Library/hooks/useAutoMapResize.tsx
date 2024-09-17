// bloom-maps/app/Library/hooks/useAutoMapResize.tsx

import { useEffect } from 'react';
import { useTreeDimensions } from '@/app/Library/Context/TreeDimensionsProvider';

export function useAutoMapResize(mapRef: React.RefObject<HTMLDivElement>) {
  const { minX, maxX, minY, maxY, currentHorizontalSpacing } = useTreeDimensions();
  const offset: number = currentHorizontalSpacing;
  useEffect(() => {
    if (!mapRef.current) return;

    const currentMapWidth = parseInt(mapRef.current.style.width, 10) || 0;
    const currentMapHeight = parseInt(mapRef.current.style.height, 10) || 0;

    const treeWidth = maxX - minX + 400; // Add padding
    const treeHeight = maxY - minY + 200; // Add padding

    const resizeThreshold = 0.8; // 90% of current map size

    // Update resizing logic to keep the TreeContainer centered at the top
    const shouldResizeWidth = (treeWidth / 2) > (resizeThreshold * currentMapWidth / 2);
    const shouldResizeHeight = treeHeight > resizeThreshold * currentMapHeight;

    if (shouldResizeWidth || shouldResizeHeight) {
        const updateWidth: number = Math.max(currentMapWidth, treeWidth) ; //Math.max(maxX, node.x);
        const updateHeight:number = Math.max(currentMapHeight, treeHeight);
      if (shouldResizeWidth) {
        mapRef.current.style.width = `${updateWidth+ offset}px`;
      }
      if (shouldResizeHeight) {
        mapRef.current.style.height = `${updateHeight+ 200}px`;
      }
    }
  }, [minX, maxX, minY, maxY, mapRef]);
}
