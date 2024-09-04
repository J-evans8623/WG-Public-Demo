// pages/resizable-box/ResizableBox.tsx
'use client';
import React, { useEffect, useRef, useState } from 'react';

const ResizableBox: React.FC = () => {
  // Reference for Box A to control scrolling
  const boxARef = useRef<HTMLDivElement>(null); 

  // States to dynamically adjust Box B's size
  const [content, setContent] = useState<string[]>([]);
  const [minHeight, setMinHeight] = useState<number>(200); // Initial minimum height
  const [minWidth, setMinWidth] = useState<number>(300);   // Initial minimum width

  // Keep scrollbar at the bottom or right on content or size change
  useEffect(() => {
    if (boxARef.current) {
      // Scroll to the bottom and right of Box A
      boxARef.current.scrollTop = boxARef.current.scrollHeight;  // For vertical scrolling
      boxARef.current.scrollLeft = boxARef.current.scrollWidth;  // For horizontal scrolling
    }
  }, [content, minHeight, minWidth]); // Run effect when content or size changes

  // Function to add text content dynamically
  const addText = () => {
    setContent((prevContent) => [
      ...prevContent,
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    ]);
  };

  // Function to increase the minimum height of Box B
  const increasePageHeight = () => {
    setMinHeight((prevHeight) => prevHeight + 100); // Adds 100px height dynamically
  };

  // Function to increase the minimum width of Box B
  const increasePageWidth = () => {
    setMinWidth((prevWidth) => prevWidth + 100); // Adds 100px width dynamically
  };

  return (
    <div className="relative flex flex-col items-center justify-center h-screen">
      {/* Button to add content */}
      <button
        onClick={addText}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Add Text
      </button>

      {/* Button to increase page height */}
      <button
        onClick={increasePageHeight}
        className="mb-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
      >
        Increase Page Height
      </button>

      {/* Button to increase page width */}
      <button
        onClick={increasePageWidth}
        className="mb-4 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
      >
        Increase Page Width
      </button>

      {/* Outer Box A */}
      <div
        ref={boxARef} // Attach ref to Box A
        className="w-[60vw] h-[40vh] bg-gray-100 p-4 overflow-auto" // Fixed size and scrolling enabled
      >
        {/* Inner Box B */}
        <div
          className="relative"
          style={{ minHeight: `${minHeight}px`, minWidth: `${minWidth}px` }} // Dynamic size adjustments
        >
          {/* Content Inside Box B */}
          <div className="absolute top-0 left-0">
            {/* Dynamically added content */}
            {content.map((text, index) => (
              <p key={index} className="mb-4">
                {text}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResizableBox;
