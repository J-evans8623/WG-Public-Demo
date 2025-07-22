/**
 * @file ResourceDisplay.tsx (read only)
 * @description
 *   Re-usable resource card (read-only in NotesTab, editable in EditTab).
 *   This update adds UI-level validation to prevent empty “Topic,” “Title,” or
 *   “Content/Description” fields when editing. Specifically:
 *     • Introduces three boolean error flags (topicError, titleError, contentError).
 *     • Computes a plain-text `contentString` and an `isFormValid` boolean.
 *     • Implements `handleSaveClick()` to reset errors, validate each field,
 *       set error flags, and only call `onSave()` when the form is valid.
 *     • Renders inline amber-text `<p>` warnings beneath each empty field.
 *     • Exposes `onValidate` callback to notify parent when form validity changes.
 *     • All existing styling and non-validation logic is preserved.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Maximize2,
  X as CloseIcon,
  RotateCcw,
} from 'lucide-react';
import BaseResourceCard from '../../CardDisplay/v2/BaseResourceCard';
import ResourceMenu from '../../CardDisplay/ResourceMenu';
import CueCard from '../../CardDisplay/Cards/CueCard';
import NoteCard from '../../CardDisplay/Cards/NoteCard';
import ImageCard from '../../CardDisplay/Cards/ImageCard';
import QuizCard from '../../CardDisplay/Cards/QuizCard';
import QuizOverlay from '../../../utils/quiz/QuizOverlay';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';
import { useVersionHistory } from '@/app/Library/Context/VersionHistoryContext';
import { QuizType, IQuizQuestion, ResourceCard } from '@/app/Library/Definitions/Definitions';


import '@/app/studygraph/(studygraph)/components/layout/CardDisplay/v2/resourceDisplay.css';

export type ResourceType = 'cuecard' | 'note' | 'image' | 'quiz';

export interface ResourceDisplayProps {
  /* identity */
  id: string;
  nodeId?: string;
  type: ResourceType;

  /* view data */
  ConceptNodeTitle: string;
  title: string;
  content: string | object;
  imageUrl?: string;

  /* flags */
  isEditing: boolean;
  /** `true` when EditTab is displaying a brand-new draft (enables topic picker) */
  isNewCard?: boolean;

  /* callbacks */
  onTitleChange: (t: string) => void;
  onContentChange: (c: string) => void;
  onCancel: () => void;
  onSave: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAskAI: () => void;
  onImageCaption: () => void;
  onDismiss?: () => void;

  /** 
   * Called whenever the validity of the form changes. 
   * Parent can use this to enable/disable external Save button.
   */
  onValidate?: (isValid: boolean) => void;
}

const ResourceDisplay: React.FC<ResourceDisplayProps> = ({
  /* identity & display */
  id,
  nodeId,
  type,
  ConceptNodeTitle,
  title,
  content,
  imageUrl,
  isNewCard = false,
  onDelete,
  onAskAI,
  onImageCaption,
  onDismiss,

  /* validation notification */
  onValidate,
}) => {
  /* ──────────────────────────────────────────────────────────────────────────── */
  /* 1) CONTEXT + LOCAL UI STATE                                                  */
  /* ──────────────────────────────────────────────────────────────────────────── */
  const { open } = useSlideShow();
    const { isHistoryOpen, restoreResource } = useVersionHistory();
  const [quizOverlayOpen, setQuizOverlayOpen] = useState(false);
  const [cueFlipped, setCueFlipped] = useState(false);





  
     // Map this component’s ResourceType to the ResourceCard.type discriminator
  const mapToCardType = (): ResourceCard['type'] => {
    switch (type) {
      case 'cuecard':
        return 'cueCard';
      case 'note':
        return 'note';
      case 'image':
        return 'picture';
      case 'quiz':
        return 'practiceSheet';
    }
  };

    const makeRestoreCard = (): ResourceCard => ({
    id,
    nodeId: nodeId!,
    type: mapToCardType(),
    title,
    content: typeof content === 'string' ? content : JSON.stringify(content),
    ...(type === 'image' && imageUrl ? { imageUrl } : {}),
  } as ResourceCard);
  /* ──────────────────────────────────────────────────────────────────────────── */
  /* 6) RENDER VIEW BODY (INCLUDES CUECARD CENTERING)                              */
  /* ──────────────────────────────────────────────────────────────────────────── */
  const commonViewProps = { ConceptNodeTitle, title };

  const renderViewBody = () => {
    switch (type) {
      case 'note':
        return <NoteCard {...commonViewProps} content={String(content)} />;

      case 'image':
        return (
          <ImageCard
            {...commonViewProps}
            content={String(content)}
            imageUrl={imageUrl || ''}
          />
        );

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
            {...commonViewProps}
            content={{ quizType, quizContent: quizData }}
          />
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
  /* 9) FINAL JSX                                                                 */
  /*                                                                                 */
  /*    - “slide” + “resource-display” ALWAYS applied                              */
  /*    - When view‐only (!isEditing), also apply “fixed-height”                    */
  /*    - Top‐right icons wrapped in .actions-wrapper                               */
  /*    - CueCard uses .cuecard-container & .slide-content.cuecard-content for true centering */
  /*    - NOTE: “Save” is triggered by parent via `onSave`; this component’s internal `handleSaveClick()` will guard validity. */
  /*                                                                                 */
  /* ──────────────────────────────────────────────────────────────────────────── */
  return (
    <>
      <BaseResourceCard
        className={`slide resource-display ${'fixed-height' }`}
        tabIndex={ -1}
      >
        {/* ─────────────────────────────── */}
        {/* Top‐Right Buttons (View‐Only)   */}
        {/* ─────────────────────────────── */}
        {(
          <div className="actions-wrapper">
          <button
              className="action-btn"
              title="Restore resource"
              onClick={() => {
                console.log('ResourceDisplay.tsx 7028 › Restore button clicked', id);
                restoreResource(makeRestoreCard());
              }}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={() =>
                type === 'quiz' ? setQuizOverlayOpen(true) : open(id)
              }
              className="action-btn"
              title="Full screen"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="action-btn"
                title="Dismiss"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* ─────────────────────────── */}
        {/* Main Body (Slide Content)   */}
        {/* ─────────────────────────── */}
        <div
          className={`slide-content ${
          type === 'cuecard' ? 'cuecard-content' : ''
          }`}
        >
          {renderViewBody()}
        </div>

        {/* ────────────────────────────────── */}
        {/* Footer (View‐Only)                  */}
        {/* ────────────────────────────────── */}
        {<div className="slide-footer">{ConceptNodeTitle}</div>}
      </BaseResourceCard>

      {/* ───────────────────────────────────────── */}
      {/* QuizOverlay (unchanged)                   */}
      {/* ───────────────────────────────────────── */}
      {type === 'quiz' && (
        <QuizOverlay
          isOpen={quizOverlayOpen}
          onClose={() => setQuizOverlayOpen(false)}
          quizType={
            typeof content === 'string'
              ? (JSON.parse(content).quizType as QuizType) || 'multipleChoice'
              : 'multipleChoice'
          }
          title={title}
          quizData={
            typeof content === 'string'
              ? (JSON.parse(content).quizContent as IQuizQuestion[])
              : []
          }
        />
      )}
    </>
  );
};

export default ResourceDisplay;
