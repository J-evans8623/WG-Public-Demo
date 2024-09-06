// hooks/useResizableMap.tsx

import { useState, useCallback, useEffect, RefObject } from 'react';

interface UseResizableMapProps {
  mapRef: RefObject<HTMLDivElement>;
  initialWidth?: number;
  initialHeight?: number;
}

export const useResizableMap = ({ mapRef, initialWidth = 2000, initialHeight = 1400 }: UseResizableMapProps) => {
  const [width, setWidth] = useState(initialWidth);
  const [height, setHeight] = useState(initialHeight);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<'both' | 'horizontal' | 'vertical' | null>(null);
  const [initialMousePosition, setInitialMousePosition] = useState<{ x: number; y: number } | null>(null);

  const handleMouseDown = useCallback(
    (direction: 'both' | 'horizontal' | 'vertical') => (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsResizing(true);
      setResizeDirection(direction);
      setInitialMousePosition({ x: e.clientX, y: e.clientY });
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !resizeDirection || !mapRef.current || !initialMousePosition) return;

      const deltaX = e.clientX - initialMousePosition.x;
      const deltaY = e.clientY - initialMousePosition.y;

      if (resizeDirection === 'horizontal' || resizeDirection === 'both') {
        setWidth((prevWidth) => Math.max(prevWidth + deltaX, 500)); // Minimum width of 500px
      }

      if (resizeDirection === 'vertical' || resizeDirection === 'both') {
        setHeight((prevHeight) => Math.max(prevHeight + deltaY, 400)); // Minimum height of 400px
      }

      setInitialMousePosition({ x: e.clientX, y: e.clientY });
    },
    [isResizing, resizeDirection, mapRef, initialMousePosition]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    setResizeDirection(null);
  }, []);

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

  return { width, height, handleMouseDown };
};
