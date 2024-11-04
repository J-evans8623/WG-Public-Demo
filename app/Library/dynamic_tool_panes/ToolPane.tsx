// bloom-maps/app/Library/dynamic_tool_panes/ToolPane.tsx
import React, { useEffect } from 'react';
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
  sourceNodeId: string; // Existing prop
}

const ToolPane: React.FC<ToolPaneProps> = ({ activeOperation, onClose, visible, sourceNodeId }) => {

  

  // Function to get the title based on the active operation
  const getOperationTitle = (operation: OperationType): string => {
    switch (operation) {
      case 'cut':
        return 'Cut Resource';
      case 'copy':
        return 'Copy Resource';
      case 'delete':
        return 'Delete Options';
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
        {/* Passing down the onClose prop to each tool pane */}
        {(activeOperation === 'cut' || activeOperation === 'copy') && (
          <ToolPaneCutCopyWindow 
            sourceNodeId={sourceNodeId} 
            command={activeOperation} 
            onClose={onClose} // New prop
          />
        )}
        {activeOperation === 'delete' && (
          <ToolPaneDeleteWindow 
            sourceNodeId={sourceNodeId} 
            onClose={onClose} // New prop
          />
        )}
        {activeOperation === 'merge' && (
          <ToolPaneMergeWindow 
            sourceNodeId={sourceNodeId} 
            onClose={onClose} // New prop
          />
        )}
        {activeOperation === 'edit' && (
          <ToolPaneEditWindow 
            sourceNodeId={sourceNodeId} 
            onClose={onClose} // New prop
          />
        )}
      </div>
    </div>
  );
};

export default ToolPane;
