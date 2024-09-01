// bloom-maps/app/ui/CueCard.tsx

'use client';

import React, { useState } from 'react';
import { CueCardProps, colorThemes } from '@/app/Definitions/Definitions';
import { useDocumentContext } from './context/DocumentProvider'; // Import the DocumentProvider context

function CueCard({ title, content }: CueCardProps) {
  const { colorTheme, bloomDepth } = useDocumentContext(); // Get Color Theme and Bloom Depth from DocumentProvider
  const [showTitle, setShowTitle] = useState(true);

  // Function to toggle between title and content
  const handleClick = () => {
    setShowTitle(!showTitle);
  };

  // Determine the color for the dot
  const themeColors = colorThemes[colorTheme];
  const bloomColor = themeColors[bloomDepth - 1] || colorThemes['gray'][0]; // Use gray if no bloom level is specified

  return (
    <div
      className="bg-white p-4 border rounded shadow-sm min-w-[150px] h-60 flex flex-col justify-center items-center cursor-pointer relative"
      onClick={handleClick}
    >
      {/* Colored dot representing bloom level */}
      <div
        className="absolute top-2 left-2 w-3 h-3 rounded-full"
        style={{ backgroundColor: bloomColor }}
        title={`Bloom Level: ${bloomDepth}`}
      ></div>

      {showTitle ? (
        <h3 className="font-bold text-xl text-gray-800 text-center leading-tight font-sans">
          {title}
        </h3>
      ) : (
        <p className="text-xl text-gray-600 text-center leading-relaxed font-sans">
          {content}
        </p>
      )}
    </div>
  );
}

export default CueCard;
