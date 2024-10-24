import React from 'react';
import { Drawer } from 'antd'; // Import the Drawer component from Ant Design
import ToolPaneCutCopyWindow from './ToolPaneCutCopyWindow';
import ToolPaneDeleteWindow from './ToolPaneDeleteWindow';
import ToolPaneMergeWindow from './ToolPaneMergeWindow';
import ToolPaneEditWindow from './ToolPaneEditWindow'; 
import './ToolPane.css';

type OperationType = 'cut-copy' | 'delete' | 'merge' | 'edit' | null;

interface ToolPaneProps {
  activeOperation: OperationType;
  onClose: () => void;
  visible: boolean;
  sourceNodeId: string; // Add the sourceNodeId prop here
  targetNodeId?: string; // Optional targetNodeId for operations like Cut/Copy or Merge
}

const ToolPane: React.FC<ToolPaneProps> = ({ activeOperation, onClose, visible, sourceNodeId, targetNodeId }) => {
  return (
    <Drawer
      title="Tool Panel"
      placement="right"
      onClose={onClose}
      open={visible} // Use 'open' instead of 'visible'
      width={400}
      mask={false}
      getContainer={false}
      style={{ position: 'absolute' }}
    >
      <div className="tool-pane">
        {activeOperation === 'cut-copy' && <ToolPaneCutCopyWindow sourceNodeId={sourceNodeId} />}
        {activeOperation === 'delete' && <ToolPaneDeleteWindow nodeId={sourceNodeId} />} {/* Pass nodeId */}
        {activeOperation === 'merge' && <ToolPaneMergeWindow sourceNodeId={sourceNodeId} />} {/* Pass sourceNodeId */}
        {activeOperation === 'edit' && <ToolPaneEditWindow nodeId={sourceNodeId} />} {/* Pass nodeId */}
      </div>
    </Drawer>
  );
};

export default ToolPane;
