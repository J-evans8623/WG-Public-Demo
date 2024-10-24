// bloom-maps\app\Library\Tests\components\ui\MapCustomizationPane.tsx


import React from 'react';
import { Select, Tooltip, Divider } from 'antd';
import { RiZoomInLine, RiZoomOutLine } from 'react-icons/ri';
import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import { setPrimaryColor, setBackgroundColor } from '@/app/Library/Context/colorThemeActions';
import { setZoomLevel } from '@/app/Library/Context/zoomActions';
import { ZoomActionType } from '@/app/Library/Definitions/Definitions';

const { Option } = Select;

const MapCustomizationPane: React.FC = () => {
    const { zoomLevel, baseZoomLevel, dispatch: zoomDispatch } = useZoomContext();
    const { primaryColor, backgroundColor, dispatch: colorThemeDispatch } = useColorThemeContext();

  const primaryColors = [
    { label: 'Light Blue', color: '#D5E6ED' },
    { label: 'Coral', color: '#F7CAAB' },
    { label: 'Mint Green', color: '#C4ACAA' },
    { label: 'Soft Pink', color: '#EBD3E0' }
  ];
  
  const backgroundColors = [
    { label: 'Cream', color: '#ECE7D1' },
    { label: 'Pale Yellow', color: '#F7EBD1' },
    { label: 'Lemon', color: '#EEECBC' },
    { label: 'White', color: '#F5F5F5' }
  ];

  // Define all Zoom Levels grounded at baseZoomLevel (0.7)
  const zoomLevels = [
    { label: '25%', value: 0.175 },  // Fixed zoom levels instead of using calculateZoomLevel
    { label: '50%', value: 0.35 },
    { label: '75%', value: 0.525 },
    { label: '100%', value: 0.7 },
    { label: '150%', value: 1.05 },
    { label: '200%', value: 1.4 }
  ];

  const handleSetPrimaryColor = (value: string) => {
    colorThemeDispatch(setPrimaryColor(value));
  };

  const handleSetBackgroundColor = (value: string) => {
    colorThemeDispatch(setBackgroundColor(value));
  };

  const handleZoomChange = (value: number) => {
    zoomDispatch(setZoomLevel(value));
  };

  const zoomIn = () => {
    zoomDispatch({ type: ZoomActionType.ZOOM_IN });
  };

  const zoomOut = () => {
    zoomDispatch({ type: ZoomActionType.ZOOM_OUT });
  };

  const currentZoomPercentage = Math.round((zoomLevel / baseZoomLevel) * 100);

  return (
    <div className="p-4">
      {/* Color Theme Selection */}
      <Divider>Color Theme</Divider>

      <div className="mb-6">
        <h4 className="mb-2">Primary Color</h4>
        <Select
          value={primaryColors.find(color => color.color === primaryColor)?.color}
          onChange={handleSetPrimaryColor}
          style={{ width: '100%' }}
          size="small"
          dropdownRender={menu => <div>{menu}</div>}
        >
          {primaryColors.map(color => (
            <Option key={color.color} value={color.color}>
              <Tooltip title={color.label}>
                <div className="flex items-center justify-between">
                  <span>{color.label}</span>
                  {/* Rectangle Color Preview */}
                  <div
                    style={{
                      width: 24,
                      height: 16,
                      backgroundColor: color.color,
                      border: '1px solid black',
                      borderRadius: '4px'
                    }}
                  />
                </div>
              </Tooltip>
            </Option>
          ))}
        </Select>

        <h4 className="mt-4 mb-2">Background Color</h4>
        <Select
          value={backgroundColors.find(color => color.color === backgroundColor)?.color}
          onChange={handleSetBackgroundColor}
          style={{ width: '100%' }}
          size="small"
          dropdownRender={menu => <div>{menu}</div>}
        >
          {backgroundColors.map(color => (
            <Option key={color.color} value={color.color}>
              <Tooltip title={color.label}>
                <div className="flex items-center justify-between">
                  <span>{color.label}</span>
                  {/* Rectangle Color Preview */}
                  <div
                    style={{
                      width: 24,
                      height: 16,
                      backgroundColor: color.color,
                      border: '1px solid black',
                      borderRadius: '4px'
                    }}
                  />
                </div>
              </Tooltip>
            </Option>
          ))}
        </Select>
      </div>

      {/* Zoom Level Settings */}
      <Divider>Zoom Level</Divider>
      <div className="flex items-center space-x-2">
        {/* Zoom In Button */}
        <Tooltip title={`Zoom In (${currentZoomPercentage}%)`}>
          <button
            className="p-2 bg-gray-300 rounded hover:bg-gray-400 flex items-center justify-center"
            onClick={zoomIn}
            style={{ fontSize: '20px', width: '40px', height: '40px' }}
            aria-label="Zoom In"
          >
            <RiZoomInLine />
          </button>
        </Tooltip>

        {/* Zoom Out Button */}
        <Tooltip title={`Zoom Out (${currentZoomPercentage}%)`}>
          <button
            className="p-2 bg-gray-300 rounded hover:bg-gray-400 flex items-center justify-center"
            onClick={zoomOut}
            style={{ fontSize: '20px', width: '40px', height: '40px' }}
            aria-label="Zoom Out"
          >
            <RiZoomOutLine />
          </button>
        </Tooltip>

        {/* Dropdown Menu for Zoom Levels */}
        <Tooltip title={`Current Zoom: ${currentZoomPercentage}%`}>
          <Select
            value={currentZoomPercentage}
            onChange={handleZoomChange}
            style={{ width: '150px' }}
            size="small"
            dropdownRender={menu => <div>{menu}</div>}
          >
            {zoomLevels.map((zoom) => (
              <Option key={zoom.value} value={zoom.value}>
                <Tooltip title={`${zoom.label}`}>
                  <span role="img" aria-label={`Zoom ${zoom.label}`}>
                    🔍 {zoom.label}
                  </span>
                </Tooltip>
              </Option>
            ))}
          </Select>
        </Tooltip>
      </div>
    </div>
  );
};

export default MapCustomizationPane;
