// bloom-maps\app\Library\dynamic_tool_panes\ToolPane.tsx
import React from 'react';
import ToolPaneCutCopyWindow from './ToolPaneCutCopyWindow';
import ToolPaneDeleteWindow from './ToolPaneDeleteWindow';
import ToolPaneMergeWindow from './ToolPaneMergeWindow';
import ToolPaneEditWindow from './ToolPaneEditWindow'; 
import './ToolPane.css';

type OperationType = 'cut' | 'copy' | 'delete' | 'merge' | 'edit' | null;

interface ToolPaneProps {
  activeOperation: OperationType;
  onClose: () => void;
  visible: boolean;
  sourceNodeId: string; // Add the sourceNodeId prop here
  targetNodeId?: string; // Optional targetNodeId for operations like Cut/Copy or Merge
}

const ToolPane: React.FC<ToolPaneProps> = ({ activeOperation, onClose, visible, sourceNodeId, targetNodeId }) => {

  const containerClasses = `tool-pane-container ${visible ? '' : 'hidden'}`;

  return (
    <div className={containerClasses}>
      <div className="tool-pane-header">
        <h3>Tool Panel</h3>
        <button onClick={onClose} className="close-button">&times;</button>
      </div>
      <div className="tool-pane-content">
        {(activeOperation === 'cut' || activeOperation === 'copy') && <ToolPaneCutCopyWindow sourceNodeId={sourceNodeId} command={activeOperation} />}
        {activeOperation === 'delete' && <ToolPaneDeleteWindow sourceNodeId={sourceNodeId} />}
        {activeOperation === 'merge' && <ToolPaneMergeWindow sourceNodeId={sourceNodeId} />}
        {activeOperation === 'edit' && <ToolPaneEditWindow sourceNodeId={sourceNodeId} />}
      </div>
    </div>
  );
};

export default ToolPane;
