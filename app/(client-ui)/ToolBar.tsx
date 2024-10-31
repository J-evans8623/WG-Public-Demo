// bloom-maps/app/Library/Components/ToolBar.tsx

import React from 'react';
import { Button, Tooltip, Select } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import SearchIcon from '@/app/icons-custom/search.svg';
import UndoIcon from '@/app/icons-custom/active/undo.svg';
import RedoIcon from '@/app/icons-custom/active/redo.svg';
import DeselectAllIcon from '@/app/icons-custom/clear_all.svg';
import AddConceptIcon from '@/app/icons-custom/active/AddConceptActiveSq.svg';
import AddCueCardIcon from '@/app/icons-custom/active/AddCueCard.svg';
import AddPictureIcon from '@/app/icons-custom/active/AddPictureActive.svg';
import AddQuizIcon from '@/app/icons-custom/active/quiz_tool_button.svg';
import MergeIcon from '@/app/icons-custom/active/MergeBranch1.svg';
import EditIcon from '@mui/icons-material/Edit';
import ContentCutOutlinedIcon from '@mui/icons-material/ContentCutOutlined';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import DeleteIcon from '@mui/icons-material/Delete';
import './ToolBar.css'; // Import custom CSS
import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import { setPrimaryColor, setBackgroundColor } from '@/app/Library/Context/colorThemeActions';
import { ZoomActionType } from '@/app/Library/Definitions/Definitions';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useResourceContext } from '@/app/Library/Context/ResourceContext'; // Import ResourceContext

const { Option } = Select;

interface ToolBarProps {
  onSearch: () => void;
  onOpenToolPane: (operation: 'cut' | 'copy' | 'delete' | 'merge' | 'edit' | null, sourceNodeId: string | null) => void; // Updated to accept null
  openModalWithResourceType: (nodeId: string | null, resourceType: 'cueCard' | 'picture' | 'practiceSheet' | undefined, op: 'resource' | 'node') => void;
}

const ToolBar: React.FC<ToolBarProps> = ({
  onSearch,
  onOpenToolPane,
  openModalWithResourceType
}) => {
  const { zoomLevel, baseZoomLevel, dispatch: zoomDispatch } = useZoomContext();
  const { primaryColor, backgroundColor, dispatch: colorThemeDispatch } = useColorThemeContext();
  const { clearSelection, getSelectedNodeIds, focusOnSelectedNode } = useNodeSelection(); // Destructure focusOnSelectedNode

  // Access the ResourceContext
  const {
    undo,
    redo,
    undoAvailable,
    redoAvailable,
  } = useResourceContext();

  // Get the selected node IDs and pick the first one for operations
  const selectedNodeIds = getSelectedNodeIds();
  const selectedNodeId = selectedNodeIds.length > 0 ? selectedNodeIds[selectedNodeIds.length -1] : null;

  // Define zoom levels and conversion from percentage
  const zoomLevels = [
    { label: '25%', value: 0.175 },
    { label: '50%', value: 0.35 },
    { label: '75%', value: 0.525 },
    { label: '100%', value: 0.7 },
    { label: '150%', value: 1.05 },
    { label: '200%', value: 1.4 },
  ];

  /**
   * Handler for undo action.
   */
  const handleUndo = () => {
    const focusedNodeId = focusOnSelectedNode();
    if (focusedNodeId && undoAvailable(focusedNodeId)) {
      undo(focusedNodeId);
    }
  };

  /**
   * Handler for redo action.
   */
  const handleRedo = () => {
    const focusedNodeId = focusOnSelectedNode();
    if (focusedNodeId && redoAvailable(focusedNodeId)) {
      redo(focusedNodeId);
    }
  };

  const currentZoomPercentage = Math.round((zoomLevel / baseZoomLevel) * 100);

  const zoomIn = () => {
    zoomDispatch({ type: ZoomActionType.ZOOM_IN });
  };

  const zoomOut = () => {
    zoomDispatch({ type: ZoomActionType.ZOOM_OUT });
  };

  const handleZoomChange = (value: number) => {
    zoomDispatch({ type: ZoomActionType.SET_ZOOM_LEVEL, payload: value });
  };

  // Color theme handlers
  const handleSetPrimaryColor = (value: string) => {
    colorThemeDispatch(setPrimaryColor(value));
  };

  const handleSetBackgroundColor = (value: string) => {
    colorThemeDispatch(setBackgroundColor(value));
  };

  // Predefined color choices
  const primaryColors = [
    { label: 'Light Blue', color: '#D5E6ED' },
    { label: 'Coral', color: '#F7CAAB' },
    { label: 'Mint Green', color: '#C4ACAA' },
    { label: 'Soft Pink', color: '#EBD3E0' }
  ];

  const backgroundColors = [
    { label: 'Lemon', color: '#EEECBC' },
    { label: 'Cream', color: '#ECE7D1' },
    { label: 'Pale Yellow', color: '#F7EBD1' },
    { label: 'White', color: '#F5F5F5' }
  ];

  /**
   * Wrapper function to handle focusing on the last selected node and performing the operation.
   */
  const handleOperation = (operation: 'cut' | 'copy' | 'delete' | 'merge' | 'edit' | null) => {
    const focusedNodeId = focusOnSelectedNode();
    onOpenToolPane(operation, focusedNodeId);
  };

  /**
   * Wrapper function to handle adding resources with focused node.
   */
  const handleAddResource = (resourceType: 'cueCard' | 'picture' | 'practiceSheet' | undefined, op: 'resource' | 'node') => {
    const focusedNodeId = focusOnSelectedNode();
    openModalWithResourceType(focusedNodeId, resourceType, op);
  };

  return (
    <div className="tool-bar flex space-x-2">
      {/* 1. Search */}
      <Tooltip title="Search">
        <Button className="tool-bar-button" onClick={onSearch} icon={<SearchIcon className="icon" />} />
      </Tooltip>

      {/* 2. Zoom In */}
      <Tooltip title="Zoom In">
        <Button className="tool-bar-button" onClick={zoomIn} icon={<ZoomInOutlined />} disabled={zoomLevel >= 1.4} />
      </Tooltip>

      {/* 3. Zoom Out */}
      <Tooltip title="Zoom Out">
        <Button className="tool-bar-button" onClick={zoomOut} icon={<ZoomOutOutlined />} disabled={zoomLevel <= 0.175} />
      </Tooltip>

      {/* 4. Zoom Level Dropdown */}
      <Select
        className="tool-bar-dropdown"
        value={currentZoomPercentage}
        onChange={handleZoomChange}
        style={{ width: '120px' }}
      >
        {zoomLevels.map((zoom) => (
          <Option key={zoom.value} value={zoom.value}>
            {zoom.label}
          </Option>
        ))}
      </Select>

      {/* 5. Undo */}
      <Tooltip title="Undo">
        <Button 
          className="tool-bar-button" 
          onClick={handleUndo} 
          icon={<UndoIcon className="icon" />} 
          disabled={!selectedNodeId || !undoAvailable(selectedNodeId)}
        />
      </Tooltip>

      {/* 6. Redo */}
      <Tooltip title="Redo">
        <Button 
          className="tool-bar-button" 
          onClick={handleRedo} 
          icon={<RedoIcon className="icon" />} 
          disabled={!selectedNodeId || !redoAvailable(selectedNodeId)}
        />
      </Tooltip>

      {/* 7. Deselect All */}
      <Tooltip title="Deselect All">
        <Button className="tool-bar-button" onClick={clearSelection} icon={<DeselectAllIcon className="icon" />} />
      </Tooltip>

      {/* 8. Add New Concept */}
      <Tooltip title="Add New Concept">
        <Button 
          className="tool-bar-button" 
          onClick={() => handleAddResource(undefined, 'node')} 
          icon={<AddConceptIcon className="icon" />} 
        />
      </Tooltip>

      {/* 9. Add Cue Card */}
      <Tooltip title="Add Cue Card">
        <Button 
          className="tool-bar-button" 
          onClick={() => handleAddResource('cueCard', 'resource')} 
          icon={<AddCueCardIcon className="icon" />} 
        />
      </Tooltip>

      {/* 10. Add Picture */}
      <Tooltip title="Add Picture">
        <Button 
          className="tool-bar-button" 
          onClick={() => handleAddResource('picture', 'resource')}  
          icon={<AddPictureIcon className="icon" />} 
        />
      </Tooltip>

      {/* 11. Add Quiz */}
      <Tooltip title="Add Quiz">
        <Button 
          className="tool-bar-button" 
          onClick={() => handleAddResource('practiceSheet', 'resource')} 
          icon={<AddQuizIcon className="icon" />} 
        />
      </Tooltip>

      {/* 12. Edit */}
      <Tooltip title="Edit">
        <Button
          className="tool-bar-button"
          onClick={() => handleOperation('edit')}
          icon={<EditIcon />}
          disabled={!selectedNodeId}
        />
      </Tooltip>

      {/* 13. Cut */}
      <Tooltip title="Cut">
        <Button
          className="tool-bar-button"
          onClick={() => handleOperation('cut')}
          icon={<ContentCutOutlinedIcon />}
          disabled={!selectedNodeId}
        />
      </Tooltip>

      {/* 14. Copy */}
      <Tooltip title="Copy">
        <Button
          className="tool-bar-button"
          onClick={() => handleOperation('copy')}
          disabled={!selectedNodeId}
        >
          Copy
        </Button>
      </Tooltip>

      {/* 15. Paste */}
      <Tooltip title="Paste">
        <Button className="tool-bar-button" icon={<ContentPasteIcon />} /> {/** OnClick removed temporarily */}
      </Tooltip>

      {/* 16. Merge */}
      <Tooltip title="Merge">
        <Button
          className="tool-bar-button"
          onClick={() => handleOperation('merge')}
          icon={<MergeIcon className="icon" />}
          disabled={!selectedNodeId}
        />
      </Tooltip>

      {/* 17. Delete */}
      <Tooltip title="Delete">
        <Button
          className="tool-bar-button"
          onClick={() => handleOperation('delete')}
          icon={<DeleteIcon />}
          disabled={!selectedNodeId}
        />
      </Tooltip>

      {/* 18. Primary Color */}
      <div className="color-selector">
        <h4 style={{ marginRight: '10px' }}>Primary Color</h4>
        <Select
          className="tool-bar-dropdown"
          value={primaryColor}
          onChange={handleSetPrimaryColor}
          style={{ width: '120px' }}
        >
          {primaryColors.map((color) => (
            <Option key={color.color} value={color.color}>
              {color.label}
            </Option>
          ))}
        </Select>
      </div>

      {/* 19. Secondary Color */}
      <div className="color-selector">
        <h4 style={{ marginRight: '10px' }}>Secondary Color</h4>
        <Select
          className="tool-bar-dropdown"
          value={backgroundColor}
          onChange={handleSetBackgroundColor}
          style={{ width: '120px' }}
        >
          {backgroundColors.map((color) => (
            <Option key={color.color} value={color.color}>
              {color.label}
            </Option>
          ))}
        </Select>
      </div>
    </div>
  );
};

export default ToolBar;
