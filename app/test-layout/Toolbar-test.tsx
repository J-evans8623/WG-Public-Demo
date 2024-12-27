// bloom-maps/app/Library/Components/ToolBar.tsx

import React from 'react';
import { Button, Tooltip, Select } from 'antd';
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  MergeCellsOutlined,
  PlusOutlined,
  FileTextOutlined,
  PictureOutlined,
  FormOutlined,
} from '@ant-design/icons';
import UndoIcon from '@/app/icons-custom/active/undo.svg';
import RedoIcon from '@/app/icons-custom/active/redo.svg';
import DeselectAllIcon from '@/app/icons-custom/clear_all.svg';
import AddConceptIcon from '@/app/icons-custom/active/AddConceptActiveSq.svg';
import AddCueCardIcon from '@/app/icons-custom/active/AddCueCard.svg';
import AddPictureIcon from '@/app/icons-custom/active/AddPictureActive.svg';
import AddQuizIcon from '@/app/icons-custom/active/quiz_tool_button.svg';
import MergeIcon from '@/app/icons-custom/active/MergeBranch1.svg';
import ContentCutOutlinedIcon from '@mui/icons-material/ContentCutOutlined';
import   '@/app/(client-ui)/ToolBar.css'  //.@/app/(client-ui)/ToolBar.css'; // We will minimize the usage of custom CSS
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
        <Tooltip title="Zoom In">
          <Button
            icon={<ZoomInOutlined />}
            onClick={zoomIn}
            disabled={zoomLevel >= 1.4}
            className="tool-bar-button"
          />
        </Tooltip>
        <Tooltip title="Zoom Out">
          <Button
            icon={<ZoomOutOutlined />}
            onClick={zoomOut}
            disabled={zoomLevel <= 0.175}
            className="tool-bar-button"
          />
        </Tooltip>
        <Select
          className="tool-bar-dropdown"
          value={currentZoomPercentage}
          onChange={handleZoomChange}
          bordered={false}
        >
          {zoomLevels.map((zoom) => (
            <Option key={zoom.value} value={zoom.value}>
              {zoom.label}
            </Option>
          ))}
        </Select>
      </div>
  
      {/* Separator between Zoom Controls and Undo/Redo */}
      <div className="separator"></div>
  
      {/* 2. Undo/Redo Actions Group */}
      <div className="tool-bar-group">
        <Tooltip title="Undo">
          <Button
            icon={<UndoIcon className="icon" />}
            onClick={handleUndo}
            disabled={!selectedNodeId || !undoAvailable(selectedNodeId)}
            className="tool-bar-button"
          />
        </Tooltip>
        <Tooltip title="Redo">
          <Button
            icon={<RedoIcon className="icon" />}
            onClick={handleRedo}
            disabled={!selectedNodeId || !redoAvailable(selectedNodeId)}
            className="tool-bar-button"
          />
        </Tooltip>
      </div>
  
      {/* Separator between Undo/Redo and Selection Management */}
      <div className="separator"></div>
  
      {/* 3. Selection and Management Group */}
      <div className="tool-bar-group">
        <Tooltip title="Deselect All">
          <Button
            icon={<DeselectAllIcon className="icon" />}
            onClick={clearSelection}
            className="tool-bar-button"
          />
        </Tooltip>
        <Tooltip title="Cut">
          <Button
            icon={<ContentCutOutlinedIcon />}
            onClick={() => handleOperation('cut')}
            disabled={!selectedNodeId}
            className="tool-bar-button"
          />
        </Tooltip>
        <Tooltip title="Copy">
          <Button
            icon={<CopyOutlined />}
            onClick={() => handleOperation('copy')}
            disabled={!selectedNodeId}
            className="tool-bar-button"
          />
        </Tooltip>
        <Tooltip title="Merge">
          <Button
            icon={<MergeIcon className="icon" />}
            onClick={() => handleOperation('merge')}
            disabled={!selectedNodeId}
            className="tool-bar-button"
          />
        </Tooltip>
        <Tooltip title="Edit">
          <Button
            icon={<EditOutlined />}
            onClick={() => handleOperation('edit')}
            disabled={!selectedNodeId}
            className="tool-bar-button"
          />
        </Tooltip>
        <Tooltip title="Delete">
          <Button
            icon={<DeleteOutlined />}
            onClick={() => handleOperation('delete')}
            disabled={!selectedNodeId}
            className="tool-bar-button"
          />
        </Tooltip>
      </div>
  
      {/* Separator between Selection Management and Resource Addition */}
      <div className="separator"></div>
  
      {/* 4. Editing and Resource Addition Group */}
      <div className="tool-bar-group">
        <Tooltip title="Add New Concept">
          <Button
            icon={<AddConceptIcon className="icon" />}
            onClick={() => handleAddResource(undefined, 'node')}
            disabled={!selectedNodeId}
            className="tool-bar-button"
          />
        </Tooltip>
        <Tooltip title="Add Cue Card">
          <Button
            icon={<AddCueCardIcon className="icon" />}
            onClick={() => handleAddResource('cueCard', 'resource')}
            disabled={!selectedNodeId}
            className="tool-bar-button"
          />
        </Tooltip>
        <Tooltip title="Add Picture">
          <Button
            icon={<AddPictureIcon className="icon" />}
            onClick={() => handleAddResource('picture', 'resource')}
            disabled={!selectedNodeId}
            className="tool-bar-button"
          />
        </Tooltip>
        <Tooltip title="Add Quiz">
          <Button
            icon={<AddQuizIcon className="icon" />}
            onClick={() => handleAddResource('practiceSheet', 'resource')}
            disabled={!selectedNodeId}
            className="tool-bar-button"
          />
        </Tooltip>
      </div>
  
      {/* Separator between Resource Addition and Color Theme Customization */}
      <div className="separator"></div>
  
{/* 5. Color Theme Customization Group */}
<div className="tool-bar-group">
  {/* Background Color Selector */}
  <div className="tool-bar-entry">
    <span className="text-sm text-gray-600 font-medium">Primary Color :  </span>
    <Select
      className="tool-bar-dropdown"
      value={backgroundColor}
      onChange={handleSetBackgroundColor}
      dropdownClassName="custom-dropdown"
      bordered={false}
    >
      {backgroundColors.map((color) => (
        <Option key={color.color} value={color.color}>
          {color.label}
        </Option>
      ))}
    </Select>
  </div>

  {/* Secondary Color Selector */}
  <div className="tool-bar-entry">
    <span className="text-sm text-gray-600 font-medium">Secondary  :  </span>
    <Select
      className="tool-bar-dropdown"
      value={secondaryColor}
      onChange={handleSetSecondaryColor}
      dropdownClassName="custom-dropdown"
      bordered={false}
    >
      {primaryColors.map((color) => (
        <Option key={color.color} value={color.color}>
          {color.label}
        </Option>
      ))}
    </Select>
  </div>
</div>

    </div>
  );
  
};

export default ToolBar;
