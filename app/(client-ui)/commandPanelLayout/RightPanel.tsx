// bloom-maps\app\test-layout\RightPanel.tsx

import React from 'react';
import ToolPane from '@/app/Library/dynamic_tool_panes/ToolPane-test';

interface RightPanelProps {
  visible: boolean;
  onClose: () => void;
  activeOperation: 'cut' | 'copy' | 'delete' | 'merge' | 'edit' | null;
  sourceNodeId: string;
}

const RightPanel: React.FC<RightPanelProps> = ({
  visible,
  onClose,
  activeOperation,
  sourceNodeId,
}) => {
  if (!visible) return null;

  return (
    <div className="w-80 border-l border-gray-200 bg-gray-50">
      <ToolPane
        activeOperation={activeOperation}
        visible={visible}
        onClose={onClose}
        sourceNodeId={sourceNodeId}
      />
    </div>
  );
};

export default RightPanel;
