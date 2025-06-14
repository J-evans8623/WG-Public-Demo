// NotesTab.tsx

import React, { useState, useRef, useEffect } from 'react';
import ResourceDisplay from './ResourceDisplay';
import { useOrderedResources } from '@/app/studygraph/(studygraph)/components/hooks/useOrderedResources';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import type {
  ResourceCard,
  PictureResource,
  PracticeSheetResource,
} from '@/app/Library/Definitions/Definitions';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import "./notesTab.css";  // renamed CSS file for clarity

// Map our ResourceCard.type to the ResourceDisplay prop
function mapToDisplayType(r: ResourceCard): 'cuecard' | 'note' | 'image' | 'quiz' {
  switch (r.type) {
    case 'cueCard': return 'cuecard';
    case 'note':    return 'note';
    case 'picture': return 'image';
    case 'practiceSheet': return 'quiz';
  }
}

// Extract string content for display
function getContentString(r: ResourceCard): string {
  if (r.type === 'picture') {
    const pic = r as PictureResource;
    return pic.description ? JSON.stringify(pic.description) : '';
  }
  if (r.type === 'practiceSheet') {
    const quiz = r as PracticeSheetResource;
    return JSON.stringify(quiz.content);
  }
  return (r as any).content;  // cueCard & note
}

interface NotesTabProps {
  currentTopicTitle: string;
  onAddResource: (type: 'cuecard' | 'note' | 'image' | 'quiz') => void;
  onEditResource: (id: string) => void;
}

const NotesTab: React.FC<NotesTabProps> = ({
  currentTopicTitle,
  onAddResource,
  onEditResource,
}) => {
  const ordered = useOrderedResources();
  const { dismissResource } = useNodeSelection();
  const { getNodeTitle } = useNodesContext();
  
  // Track different mouse states
  const [isHoveringTab, setIsHoveringTab] = useState(false);
  const [isHoveringCard, setIsHoveringCard] = useState(false);
  const tabRef = useRef<HTMLDivElement>(null);

  // Handle mouse entering/leaving the entire tab
  const handleTabMouseEnter = () => {
    setIsHoveringTab(true);
  };

  const handleTabMouseLeave = () => {
    setIsHoveringTab(false);
  };

  // Handle mouse entering/leaving card
  const handleCardMouseEnter = () => {
    setIsHoveringCard(true);
  };

  const handleCardMouseLeave = () => {
    setIsHoveringCard(false);
  };

  // Determine scrollbar visibility class
  const getScrollbarClass = () => {
    if (!isHoveringTab) return 'scrollbar-hidden';
    if (isHoveringCard) return 'scrollbar-hidden';
    return 'scrollbar-visible';
  };

  return (
    <div
      ref={tabRef}
      className={`notes-tab-container ${getScrollbarClass()}`}
      onMouseEnter={handleTabMouseEnter}
      onMouseLeave={handleTabMouseLeave}
    >
      <div className="space-y-4">
        {ordered.map((r) => (
          <div
            key={r.id}
            onMouseEnter={handleCardMouseEnter}
            onMouseLeave={handleCardMouseLeave}
          >
            <ResourceDisplay
              id={r.id}
              type={mapToDisplayType(r)}
              ConceptNodeTitle={getNodeTitle(r.nodeId) || 'Untitled'}
              title={r.title}
              content={getContentString(r)}
              imageUrl={r.type === 'picture' ? (r as PictureResource).imageUrl : undefined}
              isEditing={false}
              onTitleChange={() => {}}
              onContentChange={() => {}}
              onCancel={() => {}}
              onSave={() => {}}
              onEdit={() => onEditResource(r.id)}
              onDelete={() => dismissResource(r.nodeId, r.id)}
              onAskAI={() => {}}
              onImageCaption={() => {}}
              onDismiss={() => dismissResource(r.nodeId, r.id)}
            />
          </div>
        ))}

        {ordered.length === 0 && (
          <p className="text-gray-600">No notes available. Create one!</p>
        )}
      </div>
    </div>
  );
};

export default NotesTab;