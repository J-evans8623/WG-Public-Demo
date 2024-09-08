import { useState, useEffect } from 'react';
import { useTreeSizeContext } from '@/app/Archived/context/TreeSizeContext';
import { ConceptNode } from '@/app/Archived/Definitions/Definitions';

interface ResizeCheckResult {
  needsVerticalResize: boolean;
  needsHorizontalResize: boolean;
}

// New hook to determine if resizing is needed based on tree dimensions
export function useCheckTreeResize(
  nodes: ConceptNode[],
  mapRef: React.RefObject<HTMLDivElement>
): ResizeCheckResult {
  const [needsVerticalResize, setNeedsVerticalResize] = useState<boolean>(false);
  const [needsHorizontalResize, setNeedsHorizontalResize] = useState<boolean>(false);

  // Use TreeSizeContext to get the current tree dimensions
  const { treeHeight, treeWidth } = useTreeSizeContext();

  useEffect(() => {
    if (nodes.length <= 1 || !mapRef.current) {
      setNeedsVerticalResize(false);
      setNeedsHorizontalResize(false);
      return;
    }

    // Get the dimensions of the map container
    const mapHeight = mapRef.current.clientHeight;
    const mapWidth = mapRef.current.clientWidth;

    // Compare the tree dimensions to 60% of the map size
    setNeedsVerticalResize(treeHeight > 0.6 * mapHeight);
    setNeedsHorizontalResize(treeWidth > 0.6 * mapWidth);
  }, [nodes, mapRef, treeHeight, treeWidth]);

  return { needsVerticalResize, needsHorizontalResize };
}
