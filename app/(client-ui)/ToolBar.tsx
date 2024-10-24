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
import MergeIcon from '@/app/icons-custom/active/MergeBranch.svg';
import EditIcon from '@mui/icons-material/Edit';
import ContentCutOutlinedIcon from '@mui/icons-material/ContentCutOutlined';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import DeleteIcon from '@mui/icons-material/Delete';
import './ToolBar.css'; // Import custom CSS
import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import { setPrimaryColor, setBackgroundColor } from '@/app/Library/Context/colorThemeActions';
import { ZoomActionType } from '@/app/Library/Definitions/Definitions';
import { useToolBarActions } from './ToolBarActions'; // Import the hook for toolbar actions
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';

const { Option } = Select;

interface ToolBarProps {
  onSearch: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenToolPane: (operation: 'cut-copy' | 'delete' | 'merge' | 'edit' | null, sourceNodeId: string) => void; // Trigger dynamic tool pane based on operation
}

const ToolBar: React.FC<ToolBarProps> = ({
  onSearch,
  onUndo,
  onRedo,
  onOpenToolPane,
}) => {
  const { zoomLevel, baseZoomLevel, dispatch: zoomDispatch } = useZoomContext();
  const { primaryColor, backgroundColor, dispatch: colorThemeDispatch } = useColorThemeContext();
  const { clearSelection, getSelectedNodeIds } = useNodeSelection();

  const {
    addConceptNode,
    addCueCardResource,
    addPictureResource,
    addPracticeSheetResource,
  } = useToolBarActions(); // Get the actions from ToolBarActions

  // Get the selected node IDs and pick the first one for operations
  const selectedNodeIds = getSelectedNodeIds();
  const selectedNodeId = selectedNodeIds.length > 0 ? selectedNodeIds[0] : null;

  // Define zoom levels and conversion from percentage
  const zoomLevels = [
    { label: '25%', value: 0.175 },
    { label: '50%', value: 0.35 },
    { label: '75%', value: 0.525 },
    { label: '100%', value: 0.7 },
    { label: '150%', value: 1.05 },
    { label: '200%', value: 1.4 },
  ];

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
    { label: 'Cream', color: '#ECE7D1' },
    { label: 'Pale Yellow', color: '#F7EBD1' },
    { label: 'Lemon', color: '#EEECBC' },
    { label: 'White', color: '#F5F5F5' }
  ];

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
        value={Math.round((zoomLevel / baseZoomLevel) * 100)}
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
        <Button className="tool-bar-button" onClick={onUndo} icon={<UndoIcon className="icon" />} />
      </Tooltip>

      {/* 6. Redo */}
      <Tooltip title="Redo">
        <Button className="tool-bar-button" onClick={onRedo} icon={<RedoIcon className="icon" />} />
      </Tooltip>

      {/* 7. Deselect All */}
      <Tooltip title="Deselect All">
        <Button className="tool-bar-button" onClick={clearSelection} icon={<DeselectAllIcon className="icon" />} />
      </Tooltip>

      {/* 8. Add New Concept */}
      <Tooltip title="Add New Concept">
        <Button className="tool-bar-button" onClick={() => addConceptNode(selectedNodeId || 'root', 'New Concept Node')} icon={<AddConceptIcon className="icon" />} />
      </Tooltip>

      {/* 9. Add Cue Card */}
      <Tooltip title="Add Cue Card">
        <Button className="tool-bar-button" onClick={() => addCueCardResource(selectedNodeId || 'root', { title: 'New Cue Card' })} icon={<AddCueCardIcon className="icon" />} />
      </Tooltip>

      {/* 10. Add Picture */}
      <Tooltip title="Add Picture">
        <Button className="tool-bar-button" onClick={() => addPictureResource(selectedNodeId || 'root', { title: 'New Picture' })} icon={<AddPictureIcon className="icon" />} />
      </Tooltip>

      {/* 11. Add Quiz */}
      <Tooltip title="Add Quiz">
        <Button className="tool-bar-button" onClick={() => addPracticeSheetResource(selectedNodeId || 'root', { title: 'New Practice Sheet' })} icon={<AddQuizIcon className="icon" />} />
      </Tooltip>

      {/* 12. Edit */}
      <Tooltip title="Edit">
        <Button
          className="tool-bar-button"
          onClick={() => selectedNodeId && onOpenToolPane('edit', selectedNodeId)}
          icon={<EditIcon />}
          disabled={!selectedNodeId}
        />
      </Tooltip>

      {/* 13. Cut */}
      <Tooltip title="Cut">
        <Button
          className="tool-bar-button"
          onClick={() => selectedNodeId && onOpenToolPane('cut-copy', selectedNodeId)}
          icon={<ContentCutOutlinedIcon />}
          disabled={!selectedNodeId}
        />
      </Tooltip>

      {/* 14. Copy */}
      <Tooltip title="Copy">
        <Button
          className="tool-bar-button"
          onClick={() => selectedNodeId && onOpenToolPane('cut-copy', selectedNodeId)}
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
          onClick={() => selectedNodeId && onOpenToolPane('merge', selectedNodeId)}
          icon={<MergeIcon className="icon" />}
          disabled={!selectedNodeId}
        />
      </Tooltip>

      {/* 17. Delete */}
      <Tooltip title="Delete">
        <Button
          className="tool-bar-button"
          onClick={() => selectedNodeId && onOpenToolPane('delete', selectedNodeId)}
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
