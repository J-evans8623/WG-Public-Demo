// bloom-maps/app/Library/Components/ToolBar.tsx

import React from 'react';
import { Button, Tooltip, Select } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
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
  onOpenToolPane: (
    operation: 'cut' | 'copy' | 'delete' | 'merge' | 'edit' | null,
    sourceNodeId: string
  ) => void; // Updated to accept null
  openModalWithResourceType: (
    nodeId: string | null,
    resourceType: 'cueCard' | 'picture' | 'practiceSheet' | undefined,
    op: 'resource' | 'node'
  ) => void;
}

const ToolBar: React.FC<ToolBarProps> = ({
  onOpenToolPane,
  openModalWithResourceType,
}) => {
  // Contexts for managing zoom, color themes, node selection, and resources
  const { zoomLevel, baseZoomLevel, dispatch: zoomDispatch } = useZoomContext();
  const { primaryColor: secondaryColor, backgroundColor, dispatch: colorThemeDispatch } = useColorThemeContext();
  const { clearSelection, getSelectedNodeIds, focusOnSelectedNode } = useNodeSelection();
  const { undo, redo, undoAvailable, redoAvailable } = useResourceContext();

  // Retrieve selected node ID for enabling/disabling actions
  const selectedNodeIds = getSelectedNodeIds();
  const selectedNodeId = selectedNodeIds.length > 0 ? selectedNodeIds[selectedNodeIds.length - 1] : null;

  // Predefined zoom levels
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

  // Calculate current zoom percentage for display
  const currentZoomPercentage = Math.round((zoomLevel / baseZoomLevel) * 100);

  // Handlers for zooming in and out
  const zoomIn = () => {
    zoomDispatch({ type: ZoomActionType.ZOOM_IN });
  };

  const zoomOut = () => {
    zoomDispatch({ type: ZoomActionType.ZOOM_OUT });
  };

  // Handler for changing zoom level via dropdown
  const handleZoomChange = (value: number) => {
    zoomDispatch({ type: ZoomActionType.SET_ZOOM_LEVEL, payload: value });
  };

  // Handlers for setting primary and background colors
  const handleSetSecondaryColor = (value: string) => {
    colorThemeDispatch(setPrimaryColor(value));
  };

  const handleSetBackgroundColor = (value: string) => {
    colorThemeDispatch(setBackgroundColor(value));
  };

  // Predefined color choices for primary and background themes
  const primaryColors = [
    { label: 'Light Blue', color: '#D5E6ED' },
    { label: 'Coral', color: '#F7CAAB' },
    { label: 'Mint Green', color: '#C4ACAA' },
    { label: 'Soft Pink', color: '#EBD3E0' },
  ];

  const backgroundColors = [
    { label: 'Lemon', color: '#EEECBC' },
    { label: 'Cream', color: '#ECE7D1' },
    { label: 'Pale Yellow', color: '#F7EBD1' },
    { label: 'White', color: '#F5F5F5' },
  ];

  /**
   * Wrapper function to handle focusing on the last selected node and performing the operation.
   */
  const handleOperation = (
    operation: 'cut' | 'copy' | 'delete' | 'merge' | 'edit' | null
  ) => {
    const focusedNodeId = focusOnSelectedNode();
    if (!focusedNodeId) {
      return; // Exit the function if no node is selected
    }
    onOpenToolPane(operation, focusedNodeId);
  };

  /**
   * Wrapper function to handle adding resources with focused node.
   */
  const handleAddResource = (
    resourceType: 'cueCard' | 'picture' | 'practiceSheet' | undefined,
    op: 'resource' | 'node'
  ) => {
    const focusedNodeId = focusOnSelectedNode();
    openModalWithResourceType(focusedNodeId, resourceType, op);
  };

  return (
    <div className="tool-bar">
      
      {/* 1. Zoom Controls Group */}
      <div className="tool-bar-group">
        {/* Zoom In Button */}
        <div className="tool-bar-entry">
          <Tooltip title="Zoom In">
            <Button
              className="tool-bar-button"
              onClick={zoomIn}
              icon={<ZoomInOutlined />}
              disabled={zoomLevel >= 1.4}
            />
          </Tooltip>
        </div>

        {/* Zoom Out Button */}
        <div className="tool-bar-entry">
          <Tooltip title="Zoom Out">
            <Button
              className="tool-bar-button"
              onClick={zoomOut}
              icon={<ZoomOutOutlined />}
              disabled={zoomLevel <= 0.175}
            />
          </Tooltip>
        </div>

        {/* Zoom Level Dropdown */}
        <div className="tool-bar-entry">
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
        </div>
      </div>

      {/* Separator between Zoom Controls and Undo/Redo */}
      <div className="separator"></div>

      {/* 2. Undo/Redo Actions Group */}
      <div className="tool-bar-group">
        {/* Undo Button */}
        <div className="tool-bar-entry">
          <Tooltip title="Undo">
            <Button
              className="tool-bar-button"
              onClick={handleUndo}
              icon={<UndoIcon className="icon" />}
              disabled={!selectedNodeId || !undoAvailable(selectedNodeId)}
            />
          </Tooltip>
        </div>

        {/* Redo Button */}
        <div className="tool-bar-entry">
          <Tooltip title="Redo">
            <Button
              className="tool-bar-button"
              onClick={handleRedo}
              icon={<RedoIcon className="icon" />}
              disabled={!selectedNodeId || !redoAvailable(selectedNodeId)}
            />
          </Tooltip>
        </div>
      </div>

      {/* Separator between Undo/Redo and Selection Management */}
      <div className="separator"></div>

      {/* 3. Selection and Management Group */}
      <div className="tool-bar-group">
        {/* Deselect All Button */}
        <div className="tool-bar-entry">
          <Tooltip title="Deselect All">
            <Button
              className="tool-bar-button"
              onClick={clearSelection}
              icon={<DeselectAllIcon className="icon" />}
            />
          </Tooltip>
        </div>

        {/* Cut Button */}
        <div className="tool-bar-entry">
          <Tooltip title="Cut">
            <Button
              className="tool-bar-button"
              onClick={() => handleOperation('cut')}
              icon={<ContentCutOutlinedIcon />}
              disabled={!selectedNodeId}
            />
          </Tooltip>
        </div>

              {/* 14. Copy */}
      <div className="tool-bar-entry">
        <Tooltip title="Copy">
          <Button
            className="tool-bar-button"
            onClick={() => handleOperation('copy')}
            disabled={!selectedNodeId}
          >
            Copy
          </Button>
        </Tooltip>
      </div>

        {/* Merge Button */}
        <div className="tool-bar-entry">
          <Tooltip title="Merge">
            <Button
              className="tool-bar-button"
              onClick={() => handleOperation('merge')}
              icon={<MergeIcon className="icon" />}
              disabled={!selectedNodeId}
            />
          </Tooltip>
        </div>

              {/* 4. Editing and Resource Addition Group */}
      <div className="tool-bar-group">
        {/* Edit Button */}
        <div className="tool-bar-entry">
          <Tooltip title="Edit">
            <Button
              className="tool-bar-button"
              onClick={() => handleOperation('edit')}
              icon={<EditIcon />}
              disabled={!selectedNodeId}
            />
          </Tooltip>
        </div>

        {/* Delete Button */}
        <div className="tool-bar-entry">
          <Tooltip title="Delete">
            <Button
              className="tool-bar-button"
              onClick={() => handleOperation('delete')}
              icon={<DeleteIcon />}
              disabled={!selectedNodeId}
            />
          </Tooltip>
        </div>
      </div>

      {/* Separator between Selection Management Resource Addition */}
      <div className="separator"></div>


        {/* Add New Concept Button */}
        <div className="tool-bar-entry">
          <Tooltip title="Add New Concept">
            <Button
              className="tool-bar-button"
              onClick={() => handleAddResource(undefined, 'node')}
              icon={<AddConceptIcon className="icon" />}
              disabled={!selectedNodeId}
            />
          </Tooltip>
        </div>

        {/* Add Cue Card Button */}
        <div className="tool-bar-entry">
          <Tooltip title="Add Cue Card">
            <Button
              className="tool-bar-button"
              onClick={() => handleAddResource('cueCard', 'resource')}
              icon={<AddCueCardIcon className="icon" />}
              disabled={!selectedNodeId}
            />
          </Tooltip>
        </div>

        {/* Add Picture Button */}
        <div className="tool-bar-entry">
          <Tooltip title="Add Picture">
            <Button
              className="tool-bar-button"
              onClick={() => handleAddResource('picture', 'resource')}
              icon={<AddPictureIcon className="icon" />}
              disabled={!selectedNodeId}
            />
          </Tooltip>
        </div>

        {/* Add Quiz Button */}
        <div className="tool-bar-entry">
          <Tooltip title="Add Quiz">
            <Button
              className="tool-bar-button"
              onClick={() => handleAddResource('practiceSheet', 'resource')}
              icon={<AddQuizIcon className="icon" />}
              disabled={!selectedNodeId}
            />
          </Tooltip>
        </div>
      </div>

      {/* Separator between Editing/Resource Addition and Color Theme Customization */}
      <div className="separator"></div>


      {/* 5. Color Theme Customization Group */}

                    {/* Background Color Selector */}
                    <div className="tool-bar-entry color-selector">
          <h4 style={{ marginRight: '10px' }}>Primary Color</h4>
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

      <div className="tool-bar-group">
        {/* Primary Color Selector */}
        <div className="tool-bar-entry color-selector">
          <h4 style={{ marginRight: '10px' }}>Secondary Color</h4>
          <Select
            className="tool-bar-dropdown"
            value={secondaryColor}
            onChange={handleSetSecondaryColor}
            style={{ width: '120px' }}
          >
            {primaryColors.map((color) => (
              <Option key={color.color} value={color.color}>
                {color.label}
              </Option>
            ))}
          </Select>
        </div>

      </div>

      {/* Spacer to push items to the left */}
      <div className="spacer"></div>
    </div>
  );
};

export default ToolBar;
