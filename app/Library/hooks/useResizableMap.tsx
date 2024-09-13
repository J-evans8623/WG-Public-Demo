import { useState, useCallback, useEffect, RefObject } from 'react';
import { useNewDocumentContext } from '@/app/Library/Context/newDocumentProvider';

interface UseResizableMapProps {
  mapRef: RefObject<HTMLDivElement>;
}

export const useResizableMap = ({ mapRef, centerPaneRef }: UseResizableMapProps & { centerPaneRef: RefObject<HTMLDivElement> }) => {
  const { state } = useNewDocumentContext(); // Use the new context
  const { defaultMapWidth, defaultMapHeight, zoomLevel } = state; // Destructure values from state

  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<'both' | 'horizontal' | 'vertical' | null>(null);
  const [initialMousePosition, setInitialMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [currentMousePosition, setCurrentMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [width, setWidth] = useState(defaultMapWidth);
  const [height, setHeight] = useState(defaultMapHeight);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Calculate initial offsets
  useEffect(() => {
    if (centerPaneRef.current && mapRef.current) {
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
      setCurrentMousePosition({ x: e.clientX, y: e.clientY });
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !resizeDirection || !initialMousePosition) return;

      // Update the current mouse position to draw the dashed outline
      setCurrentMousePosition({ x: e.clientX, y: e.clientY });
    },
    [isResizing, resizeDirection, initialMousePosition]
  );

  const handleMouseUp = useCallback(() => {
    if (!isResizing || !initialMousePosition || !currentMousePosition) return;

    // Calculate the delta changes
    const deltaX = (currentMousePosition.x - initialMousePosition.x) * (1 + (1 - zoomLevel)) * 2; // Scaled adjustment
    const deltaY = (currentMousePosition.y - initialMousePosition.y) * (1 + (1 - zoomLevel)) * 2; 

    // Apply new dimensions
    if (resizeDirection === 'horizontal' || resizeDirection === 'both') {
      setWidth((prevWidth) => Math.max(prevWidth + deltaX, 500)); // Update width
    }

    if (resizeDirection === 'vertical' || resizeDirection === 'both') {
      setHeight((prevHeight) => Math.max(prevHeight + deltaY, 400)); // Update height
    }

    // Adjust offsets to keep the map centered within the viewport
    if (centerPaneRef.current) {
      const offsetX = (width * zoomLevel - centerPaneRef.current.offsetWidth) / 2;
      const offsetY = (height * zoomLevel - centerPaneRef.current.offsetHeight) / 2;

      setOffset({ x: offsetX, y: offsetY });
    }

    // Reset state after resizing
    setIsResizing(false);
    setResizeDirection(null);
    setInitialMousePosition(null);
    setCurrentMousePosition(null);
  }, [isResizing, initialMousePosition, currentMousePosition, zoomLevel, resizeDirection, centerPaneRef, width, height]);

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

  return { width, height, handleMouseDown, offset, isResizing };
};
