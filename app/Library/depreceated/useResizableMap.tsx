// bloom-maps/app/Library/hooks/useResizableMap.tsx

import { useState, useCallback, useEffect, RefObject } from 'react';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';

interface UseResizableMapProps {
  mapRef: RefObject<HTMLDivElement>;
  centerPaneRef: RefObject<HTMLDivElement>;
}

export const useResizableMap = ({ mapRef, centerPaneRef }: UseResizableMapProps) => {
  const { state } = useDocumentContext();
  const { defaultMapWidth, defaultMapHeight, zoomLevel } = state;

  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<'both' | 'horizontal' | 'vertical' | null>(null);
  const [initialMousePosition, setInitialMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [currentMousePosition, setCurrentMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [width, setWidth] = useState(defaultMapWidth);
  const [height, setHeight] = useState(defaultMapHeight);

  const handleMouseDown = useCallback(
    (direction: 'both' | 'horizontal' | 'vertical') => (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsResizing(true);
      setResizeDirection(direction);
      setInitialMousePosition({ x: e.clientX, y: e.clientY });
      setCurrentMousePosition({ x: e.clientX, y: e.clientY });
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !resizeDirection || !initialMousePosition) return;

      setCurrentMousePosition({ x: e.clientX, y: e.clientY });
    },
    [isResizing, resizeDirection, initialMousePosition]
  );

  const handleMouseUp = useCallback(() => {
    if (!isResizing || !initialMousePosition || !currentMousePosition) return;

    const deltaX = (currentMousePosition.x - initialMousePosition.x) * (1 + (1 - zoomLevel)) * 2;
    const deltaY = (currentMousePosition.y - initialMousePosition.y) * (1 + (1 - zoomLevel)) * 2;

    if (resizeDirection === 'horizontal' || resizeDirection === 'both') {
      setWidth((prevWidth) => Math.max(prevWidth + deltaX, 500));
    }

    if (resizeDirection === 'vertical' || resizeDirection === 'both') {
      setHeight((prevHeight) => Math.max(prevHeight + deltaY, 400));
    }

    setIsResizing(false);
    setResizeDirection(null);
    setInitialMousePosition(null);
    setCurrentMousePosition(null);
  }, [isResizing, initialMousePosition, currentMousePosition, zoomLevel, resizeDirection]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Update the map's size based on width and height
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.style.width = `${width}px`;
      mapRef.current.style.height = `${height}px`;
    }
  }, [width, height, mapRef]);

  return { width, height, handleMouseDown };
};
