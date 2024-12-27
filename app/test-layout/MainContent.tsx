// bloom-maps\app\test-layout\MainContent.tsx

import React, { RefObject } from 'react';
import ConceptMap from '@/app/Library/components/map/ConceptMap';

interface MainContentProps {
  centerPaneRef: RefObject<HTMLDivElement>;
  openModalWithResourceType: (
    nodeId: string | null,
    resourceType: 'cueCard' | 'picture' | 'practiceSheet' | undefined,
    op: 'resource' | 'node'
  ) => void;
  onNodeClick: (id: string) => void;
}

const MainContent: React.FC<MainContentProps> = ({ centerPaneRef, openModalWithResourceType, onNodeClick }) => {
  return (
    <div
      ref={centerPaneRef}
      className="flex-1 bg-white p-4 rounded-lg overflow-auto"
      style={{
        position: 'relative',
        overflowX: 'auto',
        overflowY: 'auto',
        scrollbarWidth: 'none',
      }}
    >
      <ConceptMap
        centerPaneRef={centerPaneRef}
        openModalWithResourceType={openModalWithResourceType}
        onNodeClick={onNodeClick}
      />
    </div>
  );
};

export default MainContent;
