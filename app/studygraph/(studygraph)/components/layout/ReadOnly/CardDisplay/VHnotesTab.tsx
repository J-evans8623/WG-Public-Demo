/**
 * @file VHnotesTab.tsx (Read Only)
 * @description
 *   Read-only version of NotesTab that renders the list of existing resource cards
 *   with identical styling to the main NotesTab but with all mutating operations
 *   disabled. The component maintains the same hover states, scrollbar behavior,
 *   and visual design while preventing any editing, deletion, or resource creation.
 *   Each card is rendered in view-only mode using the same ResourceDisplay component
 *   but with edit/delete handlers replaced with no-ops or logging-only functions.
 *
 *   RESPONSIBILITIES:
 *     - Subscribe to the ordered list of resources via useOrderedResources
 *     - Handle hover states to toggle custom scrollbar visibility (same as main)
 *     - Render each ResourceDisplay in read-only view mode
 *     - Provide restore functionality for version history context
 *     - Log attempted mutations for debugging while preventing actual changes
 */

import React, { useState, useRef, useEffect } from 'react';
import ResourceDisplay from './VHresourceDisplay';
import { useOrderedResources } from '@/app/studygraph/(studygraph)/components/hooks/useOrderedResources';
import type {
  ResourceCard,
  PracticeSheetResource,
} from '@/app/Library/Definitions/Definitions';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import '@/app/studygraph/(studygraph)/components/layout/CardDisplay/v2/notesTab.css'; // Use same CSS as main NotesTab

/**
 * Map Firestore ResourceCard.type to ResourceDisplay "type" prop.
 * Same mapping function as main NotesTab for consistency.
 */
function mapToDisplayType(r: ResourceCard): 'cuecard' | 'note'| 'quiz' {
  switch (r.type) {
    case 'cueCard':
      return 'cuecard';
    case 'note':
      return 'note';
    case 'practiceSheet':
      return 'quiz';
    case 'quizAssessment':
      return 'quiz'
  }
}

/**
 * Extracts a string from ResourceCard content for display in ResourceDisplay.
 * Same extraction logic as main NotesTab for consistency.
 */
function getContentString(r: ResourceCard): string {
  if (r.type === 'practiceSheet') {
    const quiz = r as PracticeSheetResource;
    return JSON.stringify(quiz.content);
  }
  return (r as any).content; // cueCard & note
}

interface RONotesTabProps {}

const RONotesTab: React.FC<RONotesTabProps> = () => {
  // 1) Retrieve all existing resources in display order (same as main NotesTab)
  const ordered = useOrderedResources();

  // 2) For retrieving node titles to display under each card
  const { getNodeTitle } = useNodesContext();

  // 3) Track hover state management (same as main NotesTab)
  const [isHoveringTab, setIsHoveringTab] = useState(false);
  const [isHoveringCard, setIsHoveringCard] = useState(false);
  const tabRef = useRef<HTMLDivElement>(null);

  console.log('[RONotesTab.tsx][7001] Rendering read-only NotesTab with resource count:', ordered.length);

  // 4) Mouse event handlers (same logic as main NotesTab)
  const handleTabMouseEnter = () => {
    setIsHoveringTab(true);
    console.log('[RONotesTab.tsx][7002] Tab hover state: entering (read-only)');
  };

  const handleTabMouseLeave = () => {
    setIsHoveringTab(false);
    console.log('[RONotesTab.tsx][7003] Tab hover state: leaving (read-only)');
  };

  const handleCardMouseEnter = () => {
    setIsHoveringCard(true);
  };

  const handleCardMouseLeave = () => {
    setIsHoveringCard(false);
  };

  // 5) Scrollbar visibility logic (same as main NotesTab)
  const getScrollbarClass = () => {
    if (!isHoveringTab) return 'scrollbar-hidden';
    if (isHoveringCard) return 'scrollbar-hidden';
    return 'scrollbar-visible';
  };

  // 6) Set up mouse event listeners (same as main NotesTab)
  useEffect(() => {
    const node = tabRef.current;
    if (!node) {
      console.log('[RONotesTab.tsx][7004] Tab ref not available for event listeners');
      return;
    }

    node.addEventListener('mouseenter', handleTabMouseEnter);
    node.addEventListener('mouseleave', handleTabMouseLeave);

    console.log('[RONotesTab.tsx][7005] Mouse event listeners attached to read-only tab container');

    return () => {
      node.removeEventListener('mouseenter', handleTabMouseEnter);
      node.removeEventListener('mouseleave', handleTabMouseLeave);
    };
  }, []);

  // 7) Read-only handlers (no-ops with logging for debugging)
  const handleEditResourceReadOnly = (id: string) => {
    console.log('[RONotesTab.tsx][7006] Edit resource requested (read-only: no-op) ID:', id);
    // No-op in read-only mode
  };

  const handleDeleteResourceReadOnly = (nodeId: string, resourceId: string) => {
    console.log('[RONotesTab.tsx][7007] Delete resource requested (read-only: no-op) NodeID:', nodeId, 'ResourceID:', resourceId);
    // No-op in read-only mode
  };

  const handleDismissResourceReadOnly = (nodeId: string, resourceId: string) => {
    console.log('[RONotesTab.tsx][7008] Dismiss resource requested (read-only: no-op) NodeID:', nodeId, 'ResourceID:', resourceId);
    // No-op in read-only mode
  };

  const handleAskAIReadOnly = () => {
    console.log('[RONotesTab.tsx][7009] Ask AI requested (read-only: no-op)');
    // No-op in read-only mode
  };

  const handleImageCaptionReadOnly = () => {
    console.log('[RONotesTab.tsx][7010] Image caption requested (read-only: no-op)');
    // No-op in read-only mode
  };

  // 8) Render with same structure as main NotesTab but read-only behavior
  return (
    <div
      ref={tabRef}
      className={`notes-tab-container ${getScrollbarClass()}`}
      style={{
        // Same styling as main NotesTab
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
        minHeight: 0,
        padding: '1rem',
      }}
    >
      {/* Content wrapper with same structure */}
      <div className="notes-content-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {ordered.length > 0 ? (
          ordered.map((r) => {
            console.log('[RONotesTab.tsx][7011] Rendering read-only resource card:', r.id, 'Type:', r.type);
            
            return (
              <div
                key={r.id}
                onMouseEnter={handleCardMouseEnter}
                onMouseLeave={handleCardMouseLeave}
                style={{ flexShrink: 0 }}
              >
                <ResourceDisplay
                  id={r.id}
                  nodeId={r.nodeId}
                  type={mapToDisplayType(r)}
                  ConceptNodeTitle={getNodeTitle(r.nodeId) ?? 'Untitled'}
                  title={r.title}
                  content={getContentString(r)}
                  isEditing={false} // Always false in read-only mode
                  onTitleChange={() => {}} // No-op
                  onContentChange={() => {}} // No-op
                  onCancel={() => {}} // No-op
                  onSave={() => {}} // No-op
                  onEdit={() => handleEditResourceReadOnly(r.id)} // No-op with logging
                  onDelete={() => handleDeleteResourceReadOnly(r.nodeId, r.id)} // No-op with logging
                  onAskAI={handleAskAIReadOnly} // No-op with logging
                  onDismiss={() => handleDismissResourceReadOnly(r.nodeId, r.id)} // No-op with logging
                />
              </div>
            );
          })
        ) : (
          // Same empty state as main NotesTab
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p className="text-gray-600">
              No notes available.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RONotesTab;