import React, { useState } from 'react';

const PremiumZoomToolbar = () => {
  const [zoomLevel, setZoomLevel] = useState(50);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(true);

  const handleZoomOut = () => {
    if (zoomLevel > 10) {
      setZoomLevel(prev => Math.max(10, prev - 10));
    }
  };

  const handleZoomIn = () => {
    if (zoomLevel < 200) {
      setZoomLevel(prev => Math.min(200, prev + 10));
    }
  };

  const handleUndo = () => {
    if (canUndo) {
      // Simulate undo action
      console.log('Undo action triggered');
      // Toggle states for demo
      setCanUndo(false);
      setCanRedo(true);
    }
  };

  const handleRedo = () => {
    if (canRedo) {
      // Simulate redo action
      console.log('Redo action triggered');
      // Toggle states for demo
      setCanUndo(true);
      setCanRedo(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-8">
      <div className="flex items-center bg-gradient-to-b from-white to-gray-50 rounded-3xl px-3 py-2 shadow-lg border border-gray-200 gap-2">
        {/* Zoom Out */}
        <button
          onClick={handleZoomOut}
          disabled={zoomLevel <= 10}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <svg 
            className="w-4 h-4" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth={1.5} 
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
            <path d="M8 11h6"/>
          </svg>
        </button>

        {/* Zoom Level Display */}
        <div className="px-3 py-1 text-sm font-medium text-gray-700 min-w-12 text-center">
          {zoomLevel}%
        </div>

        {/* Zoom In */}
        <button
          onClick={handleZoomIn}
          disabled={zoomLevel >= 200}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <svg 
            className="w-4 h-4" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth={1.5} 
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
            <path d="M11 8v6"/>
            <path d="M8 11h6"/>
          </svg>
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-300 mx-1"></div>

        {/* Undo */}
        <button
          onClick={handleUndo}
          disabled={!canUndo}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <svg 
            className="w-4 h-4" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth={1.5} 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"/>
          </svg>
        </button>

        {/* Redo */}
        <button
          onClick={handleRedo}
          disabled={!canRedo}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <svg 
            className="w-4 h-4" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth={1.5} 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3"/>
          </svg>
        </button>
      </div>

      {/* Demo Info */}
      <div className="absolute bottom-8 text-center text-gray-600 text-sm">
        <p>Click buttons to interact • Zoom: {zoomLevel}% • Undo: {canUndo ? 'Available' : 'Disabled'} • Redo: {canRedo ? 'Available' : 'Disabled'}</p>
      </div>
    </div>
  );
};

export default PremiumZoomToolbar;