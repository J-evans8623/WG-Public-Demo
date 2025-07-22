// NotesTab.tsx (Read Only)
// src/app/studygraph/(studygraph)/components/layout/CardDisplay/NotesTab.tsx

/**
 * @file NotesTab.tsx
 * @description
 *   Renders the list of existing resource cards for the currently selected topic.
 *   Each card can be edited, dismissed (temporary filter), or permanently deleted.
 *   This update hooks up the “delete” operation via useCardCrudOperations.deleteResource,
 *   while preserving the existing “dismiss” behavior (temporary filter).
 *
 *   RESPONSIBILITIES:
 *     - Subscribe to the ordered list of resources via useOrderedResources.
 *     - Handle hover states to toggle custom scrollbar visibility.
 *     - Render each ResourceDisplay in view‐only mode.
 *     - Wire up onEditResource (to enter edit mode), onDismiss (temporary filter),
 *       and onDelete (permanent removal) callbacks.
 */

import React, { useState, useRef, useEffect } from 'react';
import ResourceDisplay from './ResourceDisplay';
import { useOrderedResources } from '@/app/studygraph/(studygraph)/components/hooks/useOrderedResources';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import useCardCrudOperations from '@/app/studygraph/(studygraph)/components/hooks/useCardCrudOperations';
import type {
  ResourceCard,
  PictureResource,
  PracticeSheetResource,
} from '@/app/Library/Definitions/Definitions';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import '@/app/studygraph/(studygraph)/components/layout/CardDisplay/v2/notesTab.css';  // CSS for custom scrollbar behavior

/**
 * Map Firestore ResourceCard.type to ResourceDisplay “type” prop.
 */
function mapToDisplayType(r: ResourceCard): 'cuecard' | 'note' | 'image' | 'quiz' {
  switch (r.type) {
    case 'cueCard':
      return 'cuecard';
    case 'note':
      return 'note';
    case 'picture':
      return 'image';
    case 'practiceSheet':
      return 'quiz';
  }
}


/**
 * Extracts a string from ResourceCard content for display in ResourceDisplay.
 */
function getContentString(r: ResourceCard): string {
  if (r.type === 'picture') {
    const pic = r as PictureResource;
    return pic.description ? pic.description : '';
  }
  if (r.type === 'practiceSheet') {
    const quiz = r as PracticeSheetResource;
    return JSON.stringify(quiz.content);
  }
  return (r as any).content; // cueCard & note
}

interface NotesTabProps {
}

const NotesTab: React.FC<NotesTabProps> = ({
}) => {
  // 1) Retrieve all existing resources in display order
  const ordered = useOrderedResources();

  // 2) Temporary “dismiss” from view (filter) action
  const { dismissResource } = useNodeSelection();

  // 3) Permanent “delete” from backend (Y.Doc + Firestore) action
  const { deleteResource } = useCardCrudOperations();

  // 4) For retrieving node titles to display under each card
  const { getNodeTitle } = useNodesContext();

  // 5) Track hover state of the entire tab to toggle scrollbar
  const [isHoveringTab, setIsHoveringTab] = useState(false);

  // 6) Track hover state of each individual card to keep scrollbar hidden
  const [isHoveringCard, setIsHoveringCard] = useState(false);

  // 7) Tab container ref for mouse event listeners
  const tabRef = useRef<HTMLDivElement>(null);

  // Handle mouse entering/leaving the NotesTab area
  const handleTabMouseEnter = () => setIsHoveringTab(true);
  const handleTabMouseLeave = () => setIsHoveringTab(false);

  // Handle mouse entering/leaving individual cards
  const handleCardMouseEnter = () => setIsHoveringCard(true);
  const handleCardMouseLeave = () => setIsHoveringCard(false);

  // Determine which scrollbar CSS class to apply based on hover states
  const getScrollbarClass = () => {
    if (!isHoveringTab) return 'scrollbar-hidden';
    if (isHoveringCard) return 'scrollbar-hidden';
    return 'scrollbar-visible';
  };

  // Attach mouse event listeners to the tab container
  useEffect(() => {
    const node = tabRef.current;
    if (!node) return;

    node.addEventListener('mouseenter', handleTabMouseEnter);
    node.addEventListener('mouseleave', handleTabMouseLeave);

    return () => {
      node.removeEventListener('mouseenter', handleTabMouseEnter);
      node.removeEventListener('mouseleave', handleTabMouseLeave);
    };
  }, []);

  return (
    <div
      ref={tabRef}
      className={`notes-tab-container ${getScrollbarClass()}`}
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
              nodeId={r.nodeId}
              ConceptNodeTitle={getNodeTitle(r.nodeId) ?? 'Untitled'}
              title={r.title}
              content={getContentString(r)}
              imageUrl={r.type === 'picture' ? (r as PictureResource).imageUrl : undefined}
              isEditing={false}
              onTitleChange={() => {}}
              onContentChange={() => {}}
              onCancel={() => {}}
              onSave={() => {}}
              onEdit={()=>{}}
              onDelete={() => deleteResource(r.nodeId, r.id)}
              onAskAI={() => {}}
              onImageCaption={() => {}}
              onDismiss={() => dismissResource(r.nodeId, r.id)}
            />
          </div>
        ))}

        {ordered.length === 0 && (
          <p className="text-gray-600">
            No notes available. Create one!
          </p>
        )}
      </div>
    </div>
  );
};

export default NotesTab;
