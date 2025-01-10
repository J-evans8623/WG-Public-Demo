// bloom-maps\app\test-layout\LeftPanel.tsx

import React, { RefObject } from 'react';
import CueCardDisplay, { CueCardDisplayRef } from '@/app/Library/components/CardDisplay/CueCardDisplay';

interface LeftPanelProps {
  centerPaneRef: RefObject<HTMLDivElement>;
  toolPaneVisible: boolean;
}

const LeftPanel: React.FC<LeftPanelProps> = ({ centerPaneRef, toolPaneVisible }) => {
  return (
    <div className="w-96 max-w-[35%] min-w-80 border-r border-gray-200 bg-gray-50 overflow-y-auto">
      <div className="flex flex-col space-y-2 p-4">
        <CueCardDisplay
          ref={null} // Update if you need to pass refs
          centerPaneRef={centerPaneRef}
          toolPaneVisible={toolPaneVisible}
        />
      </div>
    </div>
  );
};

export default LeftPanel;
