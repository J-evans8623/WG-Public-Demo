import React from 'react';
import { Segmented, Tooltip } from 'antd';
import { RiZoomInLine, RiZoomOutLine } from 'react-icons/ri';
import { useDocumentContext } from '@/app/Library/Context/DocumentProvider';

const zoomInLevels = [
  { label: '100%', value: 1 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2 }
];

const zoomOutLevels = [
  { label: '75%', value: 0.75 },
  { label: '50%', value: 0.5 },
  { label: '25%', value: 0.25 }
];

const MapCustomizationPane: React.FC = () => {
  const { zoomIn, zoomOut, state } = useDocumentContext();
  const { zoomLevel, baseZoomLevel } = state;

  const handleZoomChange = (value: number) => {
    const normalizedZoom = value * baseZoomLevel;
    if (normalizedZoom > zoomLevel) {
      zoomIn();
    } else {
      zoomOut();
    }
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">Map Customization</h3>

      {/* Zoom In Settings */}
      <div className="flex items-center space-x-2 mb-4">
        <Tooltip title={`Zoom In (${Math.ceil((zoomLevel / baseZoomLevel) * 100)}%)`}>
          <button
            className="p-2 bg-gray-300 rounded hover:bg-gray-400 flex items-center"
            onClick={zoomIn}
            style={{ fontSize: '20px' }}
          >
            <RiZoomInLine />
          </button>
        </Tooltip>
        <Segmented
          options={zoomInLevels.map(zoom => ({
            value: zoom.value,
            label: (
              <Tooltip title={`${zoom.label}`}>
                <span role="img" aria-label={`Zoom ${zoom.label}`}>
                  🔍 {zoom.label}
                </span>
              </Tooltip>
            )
          }))}
          onChange={handleZoomChange}
        />
      </div>

      {/* Zoom Out Settings */}
      <div className="flex items-center space-x-2">
        <Tooltip title={`Zoom Out (${Math.ceil((zoomLevel / baseZoomLevel) * 100)}%)`}>
          <button
            className="p-2 bg-gray-300 rounded hover:bg-gray-400 flex items-center"
            onClick={zoomOut}
            style={{ fontSize: '20px' }}
          >
            <RiZoomOutLine />
          </button>
        </Tooltip>
        <Segmented
          options={zoomOutLevels.map(zoom => ({
            value: zoom.value,
            label: (
              <Tooltip title={`${zoom.label}`}>
                <span role="img" aria-label={`Zoom ${zoom.label}`}>
                  🔍 {zoom.label}
                </span>
              </Tooltip>
            )
          }))}
          onChange={handleZoomChange}
        />
      </div>
    </div>
  );
};

export default MapCustomizationPane;
