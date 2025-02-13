// components/layout/shared/ResizeHandle.tsx
import React from 'react';

interface ResizeHandleProps {
  onDrag: (dx: number) => void;
  placement: 'left' | 'right';
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({ 
  onDrag, 
  placement,
  onDragStart,
  onDragEnd 
}: { 
  onDrag: (dx: number) => void, 
  placement: 'left' | 'right',
  onDragStart?: () => void,
  onDragEnd?: () => void
}) => {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.pageX;
    onDragStart?.();

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.pageX - startX;
      onDrag(dx);
    };

    const handleMouseUp = () => {
      onDragEnd?.();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className={`absolute ${placement === 'right' ? 'right-[-2px]' : 'left-[-2px]'} top-0 w-1 h-full cursor-col-resize hover:bg-gray-300 active:bg-gray-400`}
      onMouseDown={handleMouseDown}
    />
  );
};