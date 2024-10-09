// bloom-maps/app/(client-ui)/ToolBar.tsx
import React from 'react';
import { Button, Tooltip } from 'antd';
import { UndoOutlined, RedoOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';

interface ToolBarProps {
  onAddStudyResource: () => void;
  onAddConcept: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  zoomLevel: number;
}

const ToolBar: React.FC<ToolBarProps> = ({
  onAddStudyResource,
  onAddConcept,
  onCut,
  onPaste,
  onDelete,
  onEdit,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  zoomLevel
}) => {
  return (
    <div className="tool-bar">
      <Tooltip title="Add Study Resource">
        <Button onClick={onAddStudyResource}>Add Study Resource</Button>
      </Tooltip>
      <Tooltip title="Add Concept">
        <Button onClick={onAddConcept}>Add Concept</Button>
      </Tooltip>
      <Tooltip title="Cut">
        <Button onClick={onCut}>Cut</Button>
      </Tooltip>
      <Tooltip title="Paste">
        <Button onClick={onPaste}>Paste</Button>
      </Tooltip>
      <Tooltip title="Delete">
        <Button onClick={onDelete}>Delete</Button>
      </Tooltip>
      <Tooltip title="Edit">
        <Button onClick={onEdit}>Edit</Button>
      </Tooltip>
      <Tooltip title="Undo">
        <Button onClick={onUndo} icon={<UndoOutlined />} />
      </Tooltip>
      <Tooltip title="Redo">
        <Button onClick={onRedo} icon={<RedoOutlined />} />
      </Tooltip>
      <Tooltip title="Zoom In">
        <Button onClick={onZoomIn} icon={<ZoomInOutlined />} />
      </Tooltip>
      <Tooltip title="Zoom Out">
        <Button onClick={onZoomOut} icon={<ZoomOutOutlined />} />
      </Tooltip>
      <span>Zoom: {zoomLevel}%</span>
    </div>
  );
};

export default ToolBar;
