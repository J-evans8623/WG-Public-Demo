// CanvasToolBar.tsx
import React from 'react';
import { Eye } from 'lucide-react';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext'; // Import the hook

interface CanvasToolbarProps {
  isResourcePanelVisible: boolean;
  onToggleResourcePanel: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenterMap: () => void;
}

export const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  isResourcePanelVisible,
  onToggleResourcePanel,
  onZoomIn,
  onZoomOut,
  onCenterMap,
}) => {
  // Access multi-select state and toggle function.
  const { multiSelectEnabled, toggleMultiSelectEnabled } = useNodeSelection();

  return (
    <div className="absolute left-10 top-1/2 -translate-y-1/2 w-12 bg-white rounded-lg shadow-lg border border-gray-200 flex flex-col items-center py-4 space-y-4 z-30">
      <button
        onClick={onToggleResourcePanel}
        className="p-2 rounded-md hover:bg-gray-100 text-gray-600 group relative inline-flex items-center justify-center"
      >
        {isResourcePanelVisible ? (
          <Eye className="h-5 w-5" />
        ) : (
          <Eye className="h-5 w-5" />
        )}
        <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50">
          {isResourcePanelVisible ? 'Hide Resources' : 'Show Resources'}
        </span>
      </button>

      {/* Zoom Controls */}
      <div className="space-y-2">
        <button 
          onClick={onZoomIn}
          className="p-2 rounded-md hover:bg-gray-100 text-gray-600 group relative inline-flex items-center justify-center"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
          </svg>
          <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50">
            Zoom In
          </span>
        </button>
        <button 
          onClick={onZoomOut}
          className="p-2 rounded-md hover:bg-gray-100 text-gray-600 group relative inline-flex items-center justify-center"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM7 10h6" />
          </svg>
          <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50">
            Zoom Out
          </span>
        </button>
      </div>

      {/* Center Map Button */}
      <button 
        onClick={onCenterMap}
        className="p-2 rounded-md hover:bg-gray-100 text-gray-600 group relative inline-flex items-center justify-center"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15v4c0 1.1.9 2 2 2h4M21 9V5c0-1.1-.9-2-2-2h-4m0 18h4c1.1 0 2-.9 2-2v-4M3 9V5c0-1.1.9-2 2-2h4" />
        </svg>
        <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50">
          Center Map
        </span>
      </button>

      {/* New Multi-Select Toggle Button */}
      <button 
        onClick={toggleMultiSelectEnabled}
        className={`p-2 rounded-md hover:bg-gray-100 text-gray-600 group relative inline-flex items-center justify-center ${
          multiSelectEnabled ? 'bg-blue-100' : ''
        }`}
        title={multiSelectEnabled ? 'Multi-Select Enabled' : 'Multi-Select Disabled'}
      >
        {/* Use an icon or text that signifies multi-select; here we use a simple text "MS" */}
        <span className="text-sm font-bold">MS</span>
        <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50">
          {multiSelectEnabled ? 'Multi-Select On' : 'Multi-Select Off'}
        </span>
      </button>
    </div>
  );
};

export default CanvasToolbar;
