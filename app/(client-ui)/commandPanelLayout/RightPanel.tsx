import React from 'react';
import ToolPane from '@/app/Library/dynamic_tool_panes/ToolPane-test';
import ResourceToolBar from '@/app/Library/Tests/resourceToolBar/resourceToolBar';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';

interface RightPanelProps {
  visible: boolean;
  onClose: () => void;
  activeOperation: 'cut' | 'copy' | 'delete' | 'merge' | 'edit' | 'addContent' | null;
  sourceNodeId: string;
}

const RightPanel: React.FC<RightPanelProps> = ({
  visible,
  onClose,
  activeOperation,
  sourceNodeId,
}) => {
  const { getFocusNode } = useNodeSelection();
  const selectedParentNode = getFocusNode();

  if (!visible) return null;

  return (
    <div className="w-80 border-l border-gray-200 bg-gray-50">
      {activeOperation === 'addContent' ? (
        <ResourceToolBar
          selectedParentNode={sourceNodeId}
          activeOperation={activeOperation}
          onClose={onClose}
        />
      ) : (
        <ToolPane
          activeOperation={activeOperation}
          visible={visible}
          onClose={onClose}
          sourceNodeId={sourceNodeId}
        />
      )}
    </div>
  );
};

export default RightPanel;