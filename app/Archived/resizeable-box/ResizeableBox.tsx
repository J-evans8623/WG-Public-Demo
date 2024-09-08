// components/ResizableBox.tsx
'use client'
import React, { useState, useRef, useCallback, useEffect } from 'react';

const ResizableBox: React.FC = () => {
  const [width, setWidth] = useState(300); // Initial width of the resizable box
  const [isResizing, setIsResizing] = useState(false);
  const resizableRef = useRef<HTMLDivElement>(null);

  // Mouse down handler to start resizing
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  // Mouse move handler to resize
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isResizing && resizableRef.current) {
        const newWidth = e.clientX - resizableRef.current.getBoundingClientRect().left;
        setWidth(newWidth > 100 ? newWidth : 100); // Minimum width of 100px
      }
    },
    [isResizing]
  );

  // Mouse up handler to stop resizing
  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }

    // Cleanup the event listeners on component unmount
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={resizableRef}
      style={{
        width: `${width}px`,
        height: '200px',
        border: '1px solid #ccc',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '10px',
          height: '100%',
          backgroundColor: '#ddd',
          cursor: 'ew-resize',
          position: 'absolute',
          top: 0,
          right: 0,
        }}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};

export default ResizableBox;
