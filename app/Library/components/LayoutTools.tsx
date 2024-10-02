'use client';

import React from 'react';
import { RiZoomInLine, RiZoomOutLine } from 'react-icons/ri';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';

const primaryColors = ['#D5E6ED', '#C4ACAA', '#F7CAAB', '#EBD3E0'];
const backgroundColors = ['#ECE7D1', '#F7EBD1', '#EEECBC', '#F5F5F5'];

const LayoutTools: React.FC = () => {
  const {
    state,
    zoomIn,
    zoomOut,
    setPrimaryColor,
    setBackgroundColor,
  } = useDocumentContext();
  const { zoomLevel, baseZoomLevel, primaryColor, backgroundColor } = state;

  const handlePrimaryColorChange = (color: string) => {
    setPrimaryColor(color);
  };

  const handleBackgroundColorChange = (color: string) => {
    setBackgroundColor(color);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Layout Tools</h2>

      {/* Zoom Controls */}
      <div className="flex items-center space-x-2 mb-4">
        <button
          title={`Zoom In (${Math.ceil((zoomLevel / baseZoomLevel) * 100)}%)`}
          onClick={zoomIn}
          className="p-1 rounded hover:bg-gray-200"
        >
          <RiZoomInLine size={24} />
        </button>
        <button
          title={`Zoom Out (${Math.ceil((zoomLevel / baseZoomLevel) * 100)}%)`}
          onClick={zoomOut}
          className="p-1 rounded hover:bg-gray-200"
        >
          <RiZoomOutLine size={24} />
        </button>
        <span className="text-sm text-gray-600">
          {Math.ceil((zoomLevel / baseZoomLevel) * 100)}%
        </span>
      </div>

      {/* Primary Color Selector */}
      <div className="mb-4">
        <label className="text-sm text-gray-700">Primary Color:</label>
        <div className="flex space-x-2 mt-2">
          {primaryColors.map((color) => (
            <button
              key={color}
              onClick={() => handlePrimaryColorChange(color)}
              className={`w-6 h-6 border rounded-full ${
                primaryColor === color ? 'ring-2 ring-blue-500' : ''
              }`}
              style={{ backgroundColor: color }}
              title={`Set Primary Color: ${color}`}
            />
          ))}
        </div>
      </div>

      {/* Background Color Selector */}
      <div className="mb-4">
        <label className="text-sm text-gray-700">Background Color:</label>
        <div className="flex space-x-2 mt-2">
          {backgroundColors.map((color) => (
            <button
              key={color}
              onClick={() => handleBackgroundColorChange(color)}
              className={`w-6 h-6 border rounded-full ${
                backgroundColor === color ? 'ring-2 ring-blue-500' : ''
              }`}
              style={{ backgroundColor: color }}
              title={`Set Background Color: ${color}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LayoutTools;
