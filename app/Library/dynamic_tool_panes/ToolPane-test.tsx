import React from 'react';
import ToolPaneCutCopyWindow from './ToolPaneCutCopyWindow';
import ToolPaneDeleteWindow from './ToolPaneDeleteWindow';
import ToolPaneMergeWindow from './ToolPaneMergeWindow';
import ToolPaneEditWindow from './ToolPaneEditWindow';
import GenerateAIForm from '../components/AI/GenerateAIForm';
import './ToolPane-test.css';


type OperationType = 'cut' | 'copy' | 'delete' | 'merge' | 'edit' | 'generateAI' | null;

interface ToolPaneProps {
  activeOperation: OperationType;
  onClose: () => void;
  visible: boolean;
  sourceNodeId: string;
}

const ToolPaneTest: React.FC<ToolPaneProps> = ({
  activeOperation,
  onClose,
  visible,
  sourceNodeId,
}) => {
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
      case 'generateAI':
        return 'Generate AI Resource';
      default:
        return '';
    }
  };

  const currentTitle = getOperationTitle(activeOperation);
  const containerClasses = `tool-pane-container ${visible ? 'visible' : 'hidden'}`;

  return (
    <div className={containerClasses}>
      <div className="tool-pane-header">
        <h3 className="tool-pane-title">{currentTitle}</h3>
        <button onClick={onClose} className="tool-pane-close-btn">&times;</button>
      </div>
      <div className="tool-pane-content">
        {(activeOperation === 'cut' || activeOperation === 'copy') && (
          <ToolPaneCutCopyWindow sourceNodeId={sourceNodeId} command={activeOperation} onClose={onClose} />
        )}
        {activeOperation === 'delete' && (
          <ToolPaneDeleteWindow sourceNodeId={sourceNodeId} onClose={onClose} />
        )}
        {activeOperation === 'merge' && (
          <ToolPaneMergeWindow sourceNodeId={sourceNodeId} onClose={onClose} />
        )}
        {activeOperation === 'edit' && (
          <ToolPaneEditWindow sourceNodeId={sourceNodeId} onClose={onClose} />
        )}
        {activeOperation === 'generateAI' && (
          <GenerateAIForm sourceNodeId={sourceNodeId} onClose={onClose} />
        )}
      </div>
    </div>
  );
};

export default ToolPaneTest;
