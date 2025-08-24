/**
 * @file NotesTab.tsx
 * @description
 * This component is responsible for rendering the list of resource cards within the right-hand panel of the application.
 * It provides a scrollable container that displays all resources associated with the currently selected topic nodes.
 * The component manages visual feedback through hover states for scrollbar visibility, ensuring a clean interface
 * that only shows scrollbars when users are actively interacting with the content area. Each resource card supports
 * editing, deletion, and dismissal operations through callbacks passed down to child components. The component
 * integrates with multiple contexts including resource ordering, node selection, and CRUD operations to maintain
 * synchronized state across the application. Special attention is paid to layout constraints to ensure proper
 * scrolling behavior within the fixed-height panel structure.
 * 
 * RESPONSIBILITIES:
 * - Subscribe to and display ordered resources from useOrderedResources hook
 * - Manage scrollbar visibility through hover state tracking
 * - Provide edit, delete, and dismiss operations for each resource card
 * - Ensure proper layout constraints for scrollable content area
 * - Handle empty state messaging when no resources are available
 * - Display default slide when no resources exist
 */

import React, { useState, useRef, useEffect } from 'react';
import ResourceDisplay from './ResourceDisplay';
import BaseResourceCard from './BaseResourceCard';
import { useOrderedResources } from '@/app/studygraph/(studygraph)/components/hooks/useOrderedResources';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import useCardCrudOperations from '@/app/studygraph/(studygraph)/components/hooks/useCardCrudOperations';
import type {
  ResourceCard,
  PracticeSheetResource,
} from '@/app/Library/Definitions/Definitions';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import './notesTab.css';

/**
 * Maps Firestore ResourceCard.type to ResourceDisplay component type prop.
 * This function ensures type safety when passing resource types to display components.
 * 
 * @param r - ResourceCard object from Firestore
 * @returns Mapped display type string for ResourceDisplay component
 */
function mapToDisplayType(r: ResourceCard): 'cuecard' | 'note'| 'quiz' {
  switch (r.type) {
    case 'cueCard':
      return 'cuecard';
    case 'note':
      return 'note';
    case 'practiceSheet':
      return 'quiz';
  }
}

/**
 * Extracts displayable content string from ResourceCard based on its type.
 * Handles special cases for picture descriptions and practice sheet JSON content.
 * 
 * @param r - ResourceCard object containing content to extract
 * @returns String representation of the resource content for display
 */
function getContentString(r: ResourceCard): string {
  if (r.type === 'practiceSheet') {
    const quiz = r as PracticeSheetResource;
    return JSON.stringify(quiz.content);
  }
  return (r as any).content;
}

/**
 * Default slide component shown when no resources are available.
 * Matches the styling of ResourceDisplay cards but shows onboarding content.
 */
const DefaultSlide: React.FC = () => {
  return (
    <BaseResourceCard className="resource-display preview-slide fixed-height">
      {/* Header */}
      <div className="preview-slide-header">
        <div className="preview-slide-title">Adding your first card</div>
        <div className="preview-slide-actions">
          {/* Empty actions area to maintain layout consistency */}
        </div>
      </div>

      {/* Body */}
      <div className="preview-slide-body">
        <div className="preview-slide-content" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          textAlign: 'center',
          color: '#6b7280', // text-gray-500
          fontSize: '0.875rem', // text-sm
          padding: '2rem'
        }}>
          Select a concept node and click add card to get started...
        </div>
      </div>

      {/* Footer */}
      <div className="preview-slide-footer">
        <span className="concept-node-label">Getting Started</span>
        <span className="slide-number" />
      </div>
    </BaseResourceCard>
  );
};

interface NotesTabProps {
  onAddResource: (type: 'cuecard' | 'note' | 'image' | 'quiz') => void;
  onEditResource: (id: string) => void;
}

const NotesTab: React.FC<NotesTabProps> = ({
  onAddResource,
  onEditResource,
}) => {
  // Step 1: Initialize data hooks for resource management
  const ordered = useOrderedResources();
  const { dismissResource } = useNodeSelection();
  const { deleteResource } = useCardCrudOperations();
  const { getNodeTitle } = useNodesContext();

  // Step 2: Initialize hover state tracking for scrollbar visibility
  const [isHoveringTab, setIsHoveringTab] = useState(false);
  const [isHoveringCard, setIsHoveringCard] = useState(false);
  const tabRef = useRef<HTMLDivElement>(null);

  console.log('[NotesTab.tsx][7001] Rendering NotesTab with resource count:', ordered.length);

  // Step 3: Define mouse event handlers for hover state management
  const handleTabMouseEnter = () => {
    setIsHoveringTab(true);
    console.log('[NotesTab.tsx][7002] Tab hover state: entering');
  };

  const handleTabMouseLeave = () => {
    setIsHoveringTab(false);
    console.log('[NotesTab.tsx][7003] Tab hover state: leaving');
  };

  const handleCardMouseEnter = () => {
    setIsHoveringCard(true);
  };

  const handleCardMouseLeave = () => {
    setIsHoveringCard(false);
  };

  /**
   * Determines appropriate scrollbar visibility class based on current hover states.
   * Scrollbar is hidden by default and only shown when hovering over tab but not cards.
   * 
   * @returns CSS class name for scrollbar visibility state
   */
  const getScrollbarClass = () => {
    if (!isHoveringTab) return 'scrollbar-hidden';
    if (isHoveringCard) return 'scrollbar-hidden';
    return 'scrollbar-visible';
  };

  // Step 4: Set up mouse event listeners on component mount
  useEffect(() => {
    const node = tabRef.current;
    if (!node) {
      console.log('[NotesTab.tsx][7004] Tab ref not available for event listeners');
      return;
    }

    // Step 5: Attach hover event listeners to container element
    node.addEventListener('mouseenter', handleTabMouseEnter);
    node.addEventListener('mouseleave', handleTabMouseLeave);

    console.log('[NotesTab.tsx][7005] Mouse event listeners attached to tab container');

    // Step 6: Clean up event listeners on unmount
    return () => {
      node.removeEventListener('mouseenter', handleTabMouseEnter);
      node.removeEventListener('mouseleave', handleTabMouseLeave);
    };
  }, []);

  // Step 7: Log resource operations for debugging
  const handleEditResourceWithLogging = (id: string) => {
    console.log('[NotesTab.tsx][7006] Edit resource requested for ID:', id);
    onEditResource(id);
  };

  const handleDeleteResourceWithLogging = (nodeId: string, resourceId: string) => {
    console.log('[NotesTab.tsx][7007] Delete resource requested - NodeID:', nodeId, 'ResourceID:', resourceId);
    deleteResource(nodeId, resourceId);
  };

  const handleDismissResourceWithLogging = (nodeId: string, resourceId: string) => {
    console.log('[NotesTab.tsx][7008] Dismiss resource requested - NodeID:', nodeId, 'ResourceID:', resourceId);
    dismissResource(nodeId, resourceId);
  };

  // Step 8: Render the notes container with proper structure
  return (
    <div
      ref={tabRef}
      className={`notes-tab-container ${getScrollbarClass()}`}
      style={{
        // Ensure proper flex layout and scrolling
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
        minHeight: 0,
        padding: '1rem',
      }}
    >
      {/* Step 9: Render resource cards or default slide */}
      <div className="notes-content-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {ordered.length > 0 ? (
          ordered.map((r) => {
            console.log('[NotesTab.tsx][7009] Rendering resource card:', r.id, 'Type:', r.type);
            
            return (
              <div
                key={r.id}
                onMouseEnter={handleCardMouseEnter}
                onMouseLeave={handleCardMouseLeave}
                style={{ flexShrink: 0 }}
              >
                <ResourceDisplay
                  id={r.id}
                  type={mapToDisplayType(r)}
                  ConceptNodeTitle={getNodeTitle(r.nodeId) ?? 'Untitled'}
                  title={r.title}
                  content={getContentString(r)}
                  isEditing={false}
                  onTitleChange={() => {}}
                  onContentChange={() => {}}
                  onCancel={() => {}}
                  onSave={() => {}}
                  onEdit={mapToDisplayType(r) === 'quiz' ? () => {} : () => handleEditResourceWithLogging(r.id)}
                  onDelete={() => handleDeleteResourceWithLogging(r.nodeId, r.id)}
                  onAskAI={() => {}}
                  onDismiss={() => handleDismissResourceWithLogging(r.nodeId, r.id)}
                />
              </div>
            );
          })
        ) : (
          // Step 10: Render default slide when no resources exist
          <div
            onMouseEnter={handleCardMouseEnter}
            onMouseLeave={handleCardMouseLeave}
            style={{ flexShrink: 0 }}
          >
            <DefaultSlide />
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesTab;