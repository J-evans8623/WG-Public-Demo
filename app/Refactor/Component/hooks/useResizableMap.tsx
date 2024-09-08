import { useState, useCallback, useEffect, RefObject } from 'react';
import { useDocumentContext } from '@/app/Refactor/Context/DocumentProvider';

interface UseResizableMapProps {
  mapRef: RefObject<HTMLDivElement>;
}

export const useResizableMap = ({ mapRef, centerPaneRef }: UseResizableMapProps & { centerPaneRef: RefObject<HTMLDivElement> }) => {
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<'both' | 'horizontal' | 'vertical' | null>(null);
  const [initialMousePosition, setInitialMousePosition] = useState<{ x: number; y: number } | null>(null);
  const { defaultMapWidth, defaultMapHeight, zoomLevel } = useDocumentContext(); // Access zoom level
  const [width, setWidth] = useState(defaultMapWidth);
  const [height, setHeight] = useState(defaultMapHeight);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Calculate initial offsets
  useEffect(() => {
    if (centerPaneRef.current && mapRef.current) { // Ensure both refs are not null
      const centerPaneWidth = centerPaneRef.current.offsetWidth;
      const centerPaneHeight = centerPaneRef.current.offsetHeight;

      // Calculate initial offsets based on zoom level
      const initialOffsetX = (width * zoomLevel - centerPaneWidth) / 2;
      const initialOffsetY = (height * zoomLevel - centerPaneHeight) / 2;

      setOffset({ x: initialOffsetX, y: initialOffsetY });
    }
  }, [centerPaneRef, mapRef, width, height, zoomLevel]);

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

      // Ensure that centerPaneRef is not null before accessing its properties
      if (centerPaneRef.current) {
        const offsetX = (newWidth * zoomLevel - centerPaneRef.current.offsetWidth) / 2;
        const offsetY = (newHeight * zoomLevel - centerPaneRef.current.offsetHeight) / 2;

        setOffset({ x: offsetX, y: offsetY });
      }

      setInitialMousePosition({ x: e.clientX, y: e.clientY });
    },
    [isResizing, resizeDirection, mapRef, initialMousePosition, width, height, zoomLevel, centerPaneRef]
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
