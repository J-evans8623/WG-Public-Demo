/**
 * @file VHResourceDisplay.tsx (Read Only)
 * @description
 *   Read-only version of ResourceDisplay that maintains identical branded styling
 *   and structure to the main ResourceDisplay component while disabling all mutating
 *   operations. The component renders resource cards with the same preview slide
 *   layout, header actions, and footer styling, but replaces edit/delete actions
 *   with restore functionality for version history context. All visual elements
 *   including hover states, shadows, and tokenized colors remain consistent with
 *   the main component to ensure seamless user experience across read-only and
 *   editable modes.
 */

import React, { useEffect, useState } from 'react';
import {
  X as CloseIcon,
  RotateCcw,
} from 'lucide-react';
import BaseResourceCard from '../../CardDisplay/v2/BaseResourceCard';
import CueCard from '../../CardDisplay/Cards/CueCard';
import NoteCard from '../../CardDisplay/Cards/NoteCard';
import QuizCard from '../../CardDisplay/Cards/QuizCard';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';
import { useVersionHistory } from '@/app/Library/Context/VersionHistoryContext';
import { QuizType, IQuizQuestion, ResourceCard } from '@/app/Library/Definitions/Definitions';
import '@/app/studygraph/(studygraph)/components/layout/CardDisplay/v2/resourceDisplay.css'; // Use same CSS as main ResourceDisplay

export type ResourceType = 'cuecard' | 'note' | 'quiz';

export interface ROResourceDisplayProps {
  /* identity */
  id: string;
  nodeId?: string;
  type: ResourceType;

  /* view data */
  ConceptNodeTitle: string;
  title: string;
  content: string | object;

  /* read-only flags */
  isEditing: false; // Always false in read-only mode

  /* no-op callbacks for interface compatibility */
  onTitleChange: (t: string) => void;
  onContentChange: (c: string) => void;
  onCancel: () => void;
  onSave: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAskAI: () => void;
  onDismiss?: () => void;
}

const ROResourceDisplay: React.FC<ROResourceDisplayProps> = ({
  /* identity & display */
  id,
  nodeId,
  type,
  ConceptNodeTitle,
  title,
  content,
  
  /* read-only no-op handlers */
  onDismiss,
}) => {
  /* ──────────────────────────────────────────────────────────────────────────── */
  /* 1) CONTEXT + LOCAL UI STATE (same as main ResourceDisplay)                   */
  /* ──────────────────────────────────────────────────────────────────────────── */
  const { open } = useSlideShow();
  const { isHistoryOpen, restoreResource } = useVersionHistory();
  const [quizOverlayOpen, setQuizOverlayOpen] = useState(false);
  const [cueFlipped, setCueFlipped] = useState(false);

  /* ──────────────────────────────────────────────────────────────────────────── */
  /* 2) HELPER FUNCTIONS (same as main ResourceDisplay)                            */
  /* ──────────────────────────────────────────────────────────────────────────── */
  
  // Map this component's ResourceType to the ResourceCard.type discriminator
  const mapToCardType = (): ResourceCard['type'] => {
    switch (type) {
      case 'cuecard':
        return 'cueCard';
      case 'note':
        return 'note';
      case 'quiz':
        return 'practiceSheet';
      
    }   };

  const makeRestoreCard = (): ResourceCard => ({
    id,
    nodeId: nodeId!,
    type: mapToCardType(),
    title,
    content: typeof content === 'string' ? content : JSON.stringify(content),
  } as ResourceCard);

  /* ──────────────────────────────────────────────────────────────────────────── */
  /* 3) RENDER VIEW BODY (same as main ResourceDisplay)                           */
  /* ──────────────────────────────────────────────────────────────────────────── */
  const commonViewProps = { ConceptNodeTitle, title };

  const renderViewBody = () => {
    switch (type) {
      case 'note':
        return <NoteCard {...commonViewProps} content={String(content)} />;

      case 'quiz': {
        let quizType: QuizType = 'multipleChoice';
        let quizData: IQuizQuestion[] = [];
        try {
          const raw =
            typeof content === 'string' ? JSON.parse(content) : content;
          if (raw?.quizType && Array.isArray(raw.quizContent)) {
            quizType = raw.quizType;
            quizData = raw.quizContent;
          }
        } catch {
          /* ignore bad JSON */
        }
        return (
          <QuizCard
          parentQuizId={''} mapId={''} {...commonViewProps}
          content={{ quizType, quizContent: quizData }}          />
        );
      }

      default:
        // CUECARD: Center both axes by wrapping it in .cuecard-container
        return (
          <div
            className="cuecard-container"
            onClick={() => setCueFlipped((f) => !f)}
            title="Click to flip"
          >
            <CueCard
              title={title}
              content={String(content)}
              flipped={cueFlipped}
            />
          </div>
        );
    }
  };

  /* ──────────────────────────────────────────────────────────────────────────── */
  /* 4) FINAL JSX (same structure as main ResourceDisplay but read-only actions)  */
  /* ──────────────────────────────────────────────────────────────────────────── */
  return (
    <>
      <BaseResourceCard
        className="resource-display preview-slide fixed-height"
        tabIndex={-1}
      >
        {/* Header: Same structure as main but with read-only actions */}
        <div className="preview-slide-header">
          <div className="preview-slide-title">{title}</div>
          <div className="preview-slide-actions">
            {/* Restore button for version history context */}
            {isHistoryOpen && (
              <button
                className="slide-action-btn"
                title="Restore resource"
                onClick={() => {
                  console.log('[ROResourceDisplay.tsx][8001] Restore button clicked:', id);
                  restoreResource(makeRestoreCard());
                }}
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
                        
            {/* Dismiss action (if provided) */}
            {onDismiss && (
              <button
                onClick={() => {
                  console.log('[ROResourceDisplay.tsx][8003] Dismiss action clicked (read-only):', id);
                  onDismiss();
                }}
                className="slide-action-btn"
                title="Dismiss"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Body: Same structure as main ResourceDisplay */}
        <div className="preview-slide-body">
          <div className="preview-slide-content">{renderViewBody()}</div>
        </div>

        {/* Footer: Same as main ResourceDisplay */}
        <div className="preview-slide-footer">
          <span className="concept-node-label">{ConceptNodeTitle}</span>
          <span className="slide-number" />
        </div>
      </BaseResourceCard>
    </>
  );
};

export default ROResourceDisplay;