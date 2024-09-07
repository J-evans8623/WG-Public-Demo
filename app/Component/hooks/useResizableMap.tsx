import { useState, useCallback, useEffect, RefObject } from 'react';
import { useDocumentContext } from '../context/DocumentProvider';

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
  const {defaultMapWidth, defaultMapHeight,} = useDocumentContext();

  // New state to hold the current offset
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

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

      const prevWidth = width;
      const prevHeight = height;

      let newWidth = prevWidth;
      let newHeight = prevHeight;

      // Calculate new dimensions
      if (resizeDirection === 'horizontal' || resizeDirection === 'both') {
        newWidth = Math.max(prevWidth + deltaX, 500); // Minimum width of 500px
        setWidth(newWidth);
      }

      if (resizeDirection === 'vertical' || resizeDirection === 'both') {
        newHeight = Math.max(prevHeight + deltaY, 400); // Minimum height of 400px
        setHeight(newHeight);
      }

      // Calculate the offset to keep the center position constant
      const offsetX = (newWidth - defaultMapWidth) /2; 
      const offsetY = (newHeight - defaultMapHeight) / 2; 
      setOffset(() => ({
        x: offsetX ,  
        y: offsetY ,
      }));

      setInitialMousePosition({ x: e.clientX, y: e.clientY });
    },
    [isResizing, resizeDirection, mapRef, initialMousePosition, width, height,initialHeight,initialWidth]
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

  return { width, height, handleMouseDown, offset };
};
