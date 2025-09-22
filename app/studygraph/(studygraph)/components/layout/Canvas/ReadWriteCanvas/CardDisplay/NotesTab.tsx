/**
 * @file bloom-maps/app/studygraph/(studygraph)/components/layout/Canvas/ReadWriteCanvas/CardDisplay/NotesTab.tsx
 * @description
 * The unified NotesTab renders the right-rail “Notes & Resources” list for both read/write (RW) and read-only (RO)
 * modes using a single implementation guarded by a boolean capability flag. Its core responsibility is to present
 * the ordered resource cards (notes, cue cards, and practice sheets/quizzes) with pixel-parity to the legacy tabs
 * while deterministically gating all mutating actions—edit, delete, dismiss, image captioning—behind a `canEdit`
 * prop. The component preserves all existing DOM/CSS hooks (e.g., notes-tab-container, scrollbar-visibility) so
 * that hover scrollbars, spacing, and tests remain stable. It wires hover listeners in O(1), performs O(N) only
 * to map and render the existing resources, and emits focused console logs (file + unique 4-digit codes) at high
 * signal checkpoints. We also **filter out `quizAssessment`** (never shown in Notes) and narrow the local
 * `mapToDisplayType` parameter to keep the switch exhaustive and silence TS2366.
 */

import React, { useEffect, useRef, useState } from 'react';
import ResourceDisplay from '@/app/studygraph/(studygraph)/components/layout/Canvas/ReadWriteCanvas/Cards/ResourceDisplay';
import { useOrderedResources } from '@/app/studygraph/(studygraph)/components/hooks/useOrderedResources';
import type {
  ResourceCard,
  PracticeSheetResource,
  QuizAssessmentResource, // update - 7300
} from '@/app/Library/Definitions/Definitions';
import type { ResourceType } from '@/app/studygraph/(studygraph)/components/layout/CardDisplay/v2/AddResourceDropdown.tsx';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import '@/app/studygraph/(studygraph)/components/layout/CardDisplay/v2/notesTab.css';
import DefaultEmptyResourceCard from '@/app/studygraph/(studygraph)/components/layout/Canvas/ReadWriteCanvas/CardDisplay/DefaultEmptyResourceCard'; // update - 7322

type DisplayType = 'cuecard' | 'note' | 'quiz';

export interface NotesTabProps {
  canEdit?: boolean; // update - 7301
  onAddResource?: (type: ResourceType) => void;
  onEditResource?: (id: string) => void;
}

const NotesTab: React.FC<NotesTabProps> = ({
  canEdit = false, // update - 7302
  onAddResource,
  onEditResource,
}) => {
  const ordered = useOrderedResources();
  const { getNodeTitle } = useNodesContext();

  const [isHoveringTab, setIsHoveringTab] = useState(false);
  const [isHoveringCard, setIsHoveringCard] = useState(false);
  const tabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('[NotesTab.tsx][7301] mount → ordered resources:', ordered.length, 'canEdit:', canEdit);
  }, [ordered.length, canEdit]);

  const handleTabMouseEnter = () => {
    setIsHoveringTab(true);
    console.log('[NotesTab.tsx][7302] hover enter');
  };
  const handleTabMouseLeave = () => {
    setIsHoveringTab(false);
    console.log('[NotesTab.tsx][7303] hover leave');
  };
  const handleCardMouseEnter = () => setIsHoveringCard(true);
  const handleCardMouseLeave = () => setIsHoveringCard(false);

  useEffect(() => {
    const node = tabRef.current;
    if (!node) {
      console.log('[NotesTab.tsx][7304] tabRef not mounted');
      return;
    }
    node.addEventListener('mouseenter', handleTabMouseEnter);
    node.addEventListener('mouseleave', handleTabMouseLeave);
    console.log('[NotesTab.tsx][7305] listeners attached');
    return () => {
      node.removeEventListener('mouseenter', handleTabMouseEnter);
      node.removeEventListener('mouseleave', handleTabMouseLeave);
      console.log('[NotesTab.tsx][7306] listeners removed');
    };
  }, []);

  // --- Helpers: type‐safe mapping (exclude quizAssessment completely) ---------------------------
  type VisibleCard = Exclude<ResourceCard, QuizAssessmentResource>; // update - 7303

  const mapToDisplayType = (r: VisibleCard): DisplayType => { // update - 7304
    switch (r.type) {
      case 'cueCard':
        return 'cuecard';
      case 'note':
        return 'note';
      case 'practiceSheet':
        return 'quiz';
    }
    // Exhaustive over VisibleCard
  };

  const getContentString = (r: VisibleCard): string => {
    if (r.type === 'practiceSheet') {
      const quiz = r as PracticeSheetResource;
      return JSON.stringify(quiz.content);
    }
    return (r as any).content ?? '';
  };

  const getScrollbarClass = () => {
    if (!isHoveringTab) return 'scrollbar-hidden';
    if (isHoveringCard) return 'scrollbar-hidden';
    return 'scrollbar-visible';
  };

  // Filter out quizAssessment (never shown in Notes)
  const visible: VisibleCard[] = ordered.filter(
    (r): r is VisibleCard => r.type !== 'quizAssessment'
  ); // update - 7305

  return (
    <div
      ref={tabRef}
      className={`notes-tab-container ${getScrollbarClass()}`}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
        minHeight: 0,
        padding: '1rem',
      }}
    >
      <div className="notes-content-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {visible.length > 0 ? (
          visible.map((r) => {
            console.log('[NotesTab.tsx][7321] render item', { id: r.id, type: r.type });
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
                  isEditing={false}
                  canEdit={canEdit}
                />
              </div>
            );
          })
        ) : (
          // update - 7323
          <div
            onMouseEnter={handleCardMouseEnter} // update - 7324
            onMouseLeave={handleCardMouseLeave} // update - 7325
            style={{ flexShrink: 0 }} 
          >
            <DefaultEmptyResourceCard/> 
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesTab;
