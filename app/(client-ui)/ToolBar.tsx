// bloom-maps/app/(client-ui)/ToolBar.tsx
import React from 'react';
import { Button, Tooltip, Select } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import SearchIcon from '@/app/icons-custom/search.svg';
import UndoIcon from '@/app/icons-custom/undo.svg';
import RedoIcon from '@/app/icons-custom/redo.svg';
import DeselectAllIcon from '@/app/icons-custom/clear_all.svg';
import AddConceptIcon from '@/app/icons-custom/AddConceptActiveSq.svg';
import AddCueCardIcon from '@/app/icons-custom/AddCueCard.svg';
import AddPictureIcon from '@/app/icons-custom/AddPictureActive.svg';
import AddQuizIcon from '@/app/icons-custom/quiz_tool_button.svg';
import MergeIcon from '@/app/icons-custom/MergeBranch.svg';
import EditIcon from '@mui/icons-material/Edit';
import ContentCutOutlinedIcon from '@mui/icons-material/ContentCutOutlined';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import DeleteIcon from '@mui/icons-material/Delete';
import './ToolBar.css'; // Import custom CSS

const { Option } = Select;

interface ToolBarProps {
  onSearch: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSetZoomLevel: (value: number) => void;
  zoomLevel: number;
  onUndo: () => void;
  onRedo: () => void;
  onDeselectAll: () => void;
  onAddConcept: () => void;
  onAddCueCard: () => void;
  onAddPicture: () => void;
  onAddQuiz: () => void;
  onEdit: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onMerge: () => void;
  onDelete: () => void;
  onSetPrimaryColor: () => void;
  onSetSecondaryColor: () => void;
  onSetTheme: () => void;
}

const ToolBar: React.FC<ToolBarProps> = ({
  onSearch,
  onZoomIn,
  onZoomOut,
  onSetZoomLevel,
  zoomLevel,
  onUndo,
  onRedo,
  onDeselectAll,
  onAddConcept,
  onAddCueCard,
  onAddPicture,
  onAddQuiz,
  onEdit,
  onCut,
  onCopy,
  onPaste,
  onMerge,
  onDelete,
  onSetPrimaryColor,
  onSetSecondaryColor,
  onSetTheme,
}) => {
  // Define zoom levels
  const zoomLevels = [
    { label: '25%', value: 25 },
    { label: '50%', value: 50 },
    { label: '75%', value: 75 },
    { label: '100%', value: 100 },
    { label: '150%', value: 150 },
    { label: '200%', value: 200 },
  ];

  return (
    <div className="tool-bar flex space-x-2">
      {/* 1. Search */}
      <Tooltip title="Search">
        <Button className="tool-bar-button" onClick={onSearch} icon={<SearchIcon className="icon" />} />
      </Tooltip>

      {/* 2. Zoom In */}
      <Tooltip title="Zoom In">
        <Button className="tool-bar-button" onClick={onZoomIn} icon={<ZoomInOutlined />} />
      </Tooltip>

      {/* 3. Zoom Out */}
      <Tooltip title="Zoom Out">
        <Button className="tool-bar-button" onClick={onZoomOut} icon={<ZoomOutOutlined />} />
      </Tooltip>
{/* 4. Zoom Level Dropdown */}
<Select
  className="tool-bar-dropdown"
  value={zoomLevel}
  onChange={onSetZoomLevel}
  style={{ width: '120px' }} // Ensure enough width to prevent cramping
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
        <Button className="tool-bar-button" onClick={onDeselectAll} icon={<DeselectAllIcon className="icon" />} />
      </Tooltip>

      {/* 8. Add New Concept */}
      <Tooltip title="Add New Concept">
        <Button className="tool-bar-button" onClick={onAddConcept} icon={<AddConceptIcon className="icon" />} />
      </Tooltip>

      {/* 9. Add Cue Card */}
      <Tooltip title="Add Cue Card">
        <Button className="tool-bar-button" onClick={onAddCueCard} icon={<AddCueCardIcon className="icon" />} />
      </Tooltip>

      {/* 10. Add Picture */}
      <Tooltip title="Add Picture">
        <Button className="tool-bar-button" onClick={onAddPicture} icon={<AddPictureIcon className="icon" />} />
      </Tooltip>

      {/* 11. Add Quiz */}
      <Tooltip title="Add Quiz">
        <Button className="tool-bar-button" onClick={onAddQuiz} icon={<AddQuizIcon className="icon" />} />
      </Tooltip>

      {/* 12. Edit */}
      <Tooltip title="Edit">
        <Button className="tool-bar-button" onClick={onEdit} icon={<EditIcon />} />
      </Tooltip>

      {/* 13. Cut */}
      <Tooltip title="Cut">
        <Button className="tool-bar-button" onClick={onCut} icon={<ContentCutOutlinedIcon />} />
      </Tooltip>

      {/* 14. Copy */}
      <Tooltip title="Copy">
        <Button className="tool-bar-button" onClick={onCopy}>Copy</Button>
      </Tooltip>

      {/* 15. Paste */}
      <Tooltip title="Paste">
        <Button className="tool-bar-button" onClick={onPaste} icon={<ContentPasteIcon />} />
      </Tooltip>

      {/* 16. Merge */}
      <Tooltip title="Merge">
        <Button className="tool-bar-button" onClick={onMerge} icon={<MergeIcon className="icon" />} />
      </Tooltip>

      {/* 17. Delete */}
      <Tooltip title="Delete">
        <Button className="tool-bar-button" onClick={onDelete} icon={<DeleteIcon />} />
      </Tooltip>

      {/* 18. Primary Color */}
      <Tooltip title="Primary Color">
        <Button className="tool-bar-button" onClick={onSetPrimaryColor}>Primary Color</Button>
      </Tooltip>

      {/* 19. Secondary Color */}
      <Tooltip title="Secondary Color">
        <Button className="tool-bar-button" onClick={onSetSecondaryColor}>Secondary Color</Button>
      </Tooltip>

      {/* 20. Theme */}
      <Tooltip title="Theme">
        <Button className="tool-bar-button" onClick={onSetTheme}>Theme</Button>
      </Tooltip>
    </div>
  );
};

export default ToolBar;
