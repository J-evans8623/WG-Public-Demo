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

}

const ToolPane: React.FC<ToolPaneProps> = ({ activeOperation, onClose, visible, sourceNodeId, }) => {



  const getOperationTitle = (operation: OperationType): string => {
    switch (operation) {
      case 'cut':
        return 'Cut Resource';
      case 'copy':
        return 'Copy Resource';
      case 'delete':
        return 'Delete Resource';
      case 'merge':
        return 'Merge Concept';
      case 'edit':
        return 'Edit Resource';
      default:
        return '';
    }
  };
  
  const currentTitle = getOperationTitle(activeOperation);
  const containerClasses = `tool-pane-container ${visible ? '' : 'hidden'}`;

  return (
    <div className={containerClasses}>
      <div className="tool-pane-header">
        <h3>{currentTitle}</h3>
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
