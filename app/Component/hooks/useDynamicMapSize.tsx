// bloom-maps/app/Component/hooks/useDynamicMapSize.tsx

import { useState, useEffect, RefObject } from 'react';
import { useCheckTreeResize } from './useCheckTreeResize';
import { ConceptNode } from '@/app/Definitions/Definitions';

interface DynamicMapSizeProps {
  mapRef: RefObject<HTMLDivElement>;
  nodes: ConceptNode[];
}

export const useDynamicMapSize = ({ mapRef, nodes }: DynamicMapSizeProps) => {
  const [minHeight, setMinHeight] = useState(800); // Initial height
  const [minWidth, setMinWidth] = useState(1200); // Initial width

  const { needsVerticalResize, needsHorizontalResize } = useCheckTreeResize(nodes, mapRef);

  useEffect(() => {
    if (!mapRef.current || nodes.length === 0) return;

    // Get current dimensions
    const currentHeight = mapRef.current.clientHeight;
    const currentWidth = mapRef.current.clientWidth;

    // Increase dimensions by 25% if needed
    if (needsVerticalResize) {
      setMinHeight(currentHeight * 1.25); // Increase height by 25%
    }

    if (needsHorizontalResize) {
      setMinWidth(currentWidth * 1.25); // Increase width by 25%
    }
  }, [nodes, needsVerticalResize, needsHorizontalResize, mapRef]);

  return { minHeight, minWidth };
};
