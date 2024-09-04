'use client';
import React, { useState } from 'react';

const ResizableBox: React.FC = () => {
  // Reference for Box A to control scrolling
  const [content, setContent] = useState<string[]>([]);
  const [minHeight, setMinHeight] = useState<number>(200); // Initial minimum height
  const [minWidth, setMinWidth] = useState<number>(300);   // Initial minimum width

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
        className="w-[60vw] h-[40vh] bg-gray-100 p-4 overflow-auto flex justify-center items-center" // Center content inside and enable scrolling
      >
        {/* Inner Box B */}
        <div
          className="relative bg-white shadow-lg rounded-lg"
          style={{ minHeight: `${minHeight}px`, minWidth: `${minWidth}px`, margin: 'auto' }} // Centering and dynamic size adjustments
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
