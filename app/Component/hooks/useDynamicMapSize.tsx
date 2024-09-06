import { useState, useEffect, RefObject, useCallback } from 'react';

interface DynamicMapSizeProps {
  mapRef: RefObject<HTMLDivElement>;
}

export const useDynamicMapSize = ({ mapRef }: DynamicMapSizeProps) => {
  const [minHeight, setMinHeight] = useState(1400); // Minimum height
  const [minWidth, setMinWidth] = useState(2000); // Minimum width
  const [isResizing, setIsResizing] = useState(false); // Flag to track if resizing is active
  const [resizeDirection, setResizeDirection] = useState<'horizontal' | 'vertical' | 'both' | null>(null); // Direction of resizing

  // Handle mouse move to resize map
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !mapRef.current) return;
      console.log('working');
      const currentHeight = mapRef.current.clientHeight;
      const currentWidth = mapRef.current.clientWidth;

      if (resizeDirection === 'both' || resizeDirection === 'vertical') {
        const newHeight = Math.max(1400, currentHeight + e.movementY);
        setMinHeight(newHeight);
      }

      if (resizeDirection === 'both' || resizeDirection === 'horizontal') {
        const newWidth = Math.max(2000, currentWidth + e.movementX);
        setMinWidth(newWidth);
      }
    },
    [isResizing, resizeDirection, mapRef]
  );

  // Handle mouse up to stop resizing
  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    setResizeDirection(null);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  // Handle mouse down to start resizing
  const handleMouseDown = useCallback(
    (direction: 'horizontal' | 'vertical' | 'both') => (e: React.MouseEvent) => {
      setIsResizing(true);
      setResizeDirection(direction);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [handleMouseMove, handleMouseUp]
  );

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return { minHeight, minWidth, handleMouseDown };
};
