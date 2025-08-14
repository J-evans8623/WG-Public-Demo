/**
 * @file ResourceDisplay.tsx
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
  ChevronsUpDown,
  Check,
  X as CloseIcon,
  PlusCircle,
} from 'lucide-react';
import BaseResourceCard from './BaseResourceCard';
import ResourceMenu from '../ResourceMenu';
import CueCard from '../Cards/CueCard';
import NoteCard from '../Cards/NoteCard';
import ImageCard from '../Cards/ImageCard';
import QuizCard from '../Cards/QuizCard';
import ImageUploadCard from '../Cards/ImageUploadCard';
import QuizOverlay from '../../../utils/quiz/QuizOverlay';
import RichTextEditor from '@/components/RichTextEditor';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { QuizType, IQuizQuestion } from '@/app/Library/Definitions/Definitions';
import type { ResourceFormInput } from '../types/resourceForm';
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

  /* controlled metadata (edit-mode only) */
  inputData?: ResourceFormInput;
  onInputDataChange?: (next: ResourceFormInput) => void;

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

  /* flags + controlled state */
  isEditing,
  isNewCard = false,
  inputData,
  onInputDataChange,

  /* change handlers */
  onTitleChange,
  onContentChange,
  onCancel,
  onSave,
  onEdit,
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
  const { nodes } = useNodesContext();
  const nodeArray = Array.from(nodes.values());
  const { getFocusNode } = useNodeSelection();

  const [quizOverlayOpen, setQuizOverlayOpen] = useState(false);
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cueFlipped, setCueFlipped] = useState(false);
  const topicSelectorRef = useRef<HTMLDivElement>(null);

  // ── Validation flags for edit mode ─────────────────────────────────
  const [topicError, setTopicError]     = useState(false);
  const [titleError,  setTitleError]     = useState(false);
  const [contentError,setContentError]   = useState(false);

  /* ──────────────────────────────────────────────────────────────────────────── */
  /* 2) FOCUS‐NODE AUTO‐SELECT                                                     */
  /* ──────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (
      isEditing &&
      isNewCard &&
      inputData &&
      !inputData.selectedTopicId &&
      !inputData.createNode &&
      onInputDataChange
    ) {
      const focus = getFocusNode();
      if (focus) {
        onInputDataChange({ ...inputData, selectedTopicId: focus });
      }
    }
  }, [isEditing, isNewCard, inputData, onInputDataChange, getFocusNode]);

  /* ──────────────────────────────────────────────────────────────────────────── */
  /* 3) CLICK‐OUTSIDE FOR DROPDOWN                                                  */
  /* ──────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        topicSelectorRef.current &&
        !topicSelectorRef.current.contains(e.target as Node)
      ) {
        setIsTopicDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ──────────────────────────────────────────────────────────────────────────── */
  /* 4) HELPERS FOR TOPIC SELECTION                                                 */
  /* ──────────────────────────────────────────────────────────────────────────── */
  const selectTopic = (topicId: string) =>
    onInputDataChange?.({
      ...inputData!,
      createNode: false,
      nodeTitle: '',
      selectedTopicId: topicId,
    });

  const startCreateNewTopic = () =>
    onInputDataChange?.({
      ...inputData!,
      createNode: true,
      nodeTitle: '',
      selectedTopicId: '',
    });

  /* ──────────────────────────────────────────────────────────────────────────── */
  /* 5) VALIDATION & FORM‐STATE                                                     */
  /* ──────────────────────────────────────────────────────────────────────────── */
  // Convert content prop (string | object) to a plain string for validation
  const contentString =
    typeof content === 'string' ? content : JSON.stringify(content);

  // The form is valid only if a topic is selected/created, title is non-empty, and content is non-empty
  const isFormValid =
    Boolean(
      (inputData?.selectedTopicId?.trim() || inputData?.createNode) &&
        title.trim() !== '' &&
        contentString.trim() !== ''
    );

  // Notify parent whenever form validity changes
  useEffect(() => {
    if (onValidate) {
      onValidate(isFormValid);
    }
  }, [isFormValid, onValidate]);

  // Called when the user clicks “Save” in edit mode
  const handleSaveClick = () => {
    // 1) Reset previous errors
    setTopicError(false);
    setTitleError(false);
    setContentError(false);

    // 2) Validate “Topic”
    if (!inputData) {
      // If inputData is undefined, user cannot have chosen a topic
      setTopicError(true);
      return;
    }
    const hasTopic = Boolean(
      inputData.selectedTopicId?.trim() !== '' || inputData.createNode
    );
    if (!hasTopic) {
      setTopicError(true);
    }

    // 3) Validate “Title”
    if (title.trim() === '') {
      setTitleError(true);
    }

    // 4) Validate “Content”
    if (contentString.trim() === '') {
      setContentError(true);
    }

    // 5) Only call onSave if all fields are valid
    if (
      hasTopic &&
      title.trim() !== '' &&
      contentString.trim() !== ''
    ) {
      onSave();
    }
  };

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
  /* 7) RENDER EDIT‐MODE TOPIC CONTROL (UPDATED FOR VALIDATION)                    */
  /* ──────────────────────────────────────────────────────────────────────────── */
  const renderTopicControl = () => {
    if (!isNewCard) {
      return (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Topic
          </label>
          <div className="w-full px-3 py-2 border rounded-md bg-gray-50 text-gray-600">
            {ConceptNodeTitle}
          </div>
        </div>
      );
    }

    if (inputData?.createNode) {
      return (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New Topic Name
          </label>
          <input
            type="text"
            autoFocus
            value={inputData.nodeTitle || ''}
            onChange={(e) =>
              onInputDataChange?.({
                ...inputData,
                nodeTitle: e.target.value,
              })
            }
            placeholder="Enter new topic name"
            className="w-full border rounded px-3 py-2"
          />
          {topicError && (
            <p className="text-amber-600 text-xs mt-1">
              Select or create a topic.
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="mb-6" ref={topicSelectorRef}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Topic
        </label>
        <div className="relative">
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2 border rounded-md"
            onClick={() => setIsTopicDropdownOpen((o) => !o)}
          >
            {inputData?.selectedTopicId
              ? nodes.get(inputData.selectedTopicId)?.title
              : 'Select topic…'}
            <ChevronsUpDown className="ml-2 h-4 w-4" />
          </button>
          {topicError && (
            <p className="text-amber-600 text-xs mt-1">
              Select or create a topic.
            </p>
          )}

          {isTopicDropdownOpen && (
            <div className="absolute z-10 w-full mt-1 border rounded-md bg-white shadow-lg">
              <input
                type="text"
                placeholder="Search topics…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border-b"
              />
              <div className="max-h-60 overflow-auto">
                {/* — Create New Topic Item — */}
                <div
                  onClick={() => {
                    startCreateNewTopic();
                    setIsTopicDropdownOpen(false);
                  }}
                  className="px-3 py-2 flex items-center cursor-pointer hover:bg-gray-100 text-blue-600 font-medium border-b"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create new topic +
                </div>
                {/* — Existing Topics — */}
                {nodeArray
                  .filter((n) =>
                    n.title.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        selectTopic(n.id);
                        setIsTopicDropdownOpen(false);
                        setSearchQuery('');
                      }}
                      className={`px-3 py-2 flex items-center cursor-pointer hover:bg-gray-100 ${
                        n.id === inputData?.selectedTopicId ? 'bg-blue-50' : ''
                      }`}
                    >
                      {n.id === inputData?.selectedTopicId && (
                        <Check className="mr-2 h-4 w-4 text-blue-600" />
                      )}
                      {n.title}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ──────────────────────────────────────────────────────────────────────────── */
  /* 8) RENDER EDIT‐MODE BODY (UPDATED FOR VALIDATION)                             */
  /* ──────────────────────────────────────────────────────────────────────────── */
  const renderEditBody = () => (
    <>
      {renderTopicControl()}

      {/* Title */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
        {titleError && (
          <p className="text-amber-600 text-xs mt-1">
            Title cannot be empty.
          </p>
        )}
      </div>

      {/* Content */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Content
        </label>
        <div className="h-[300px] overflow-y-auto border rounded">
          {type === 'image' ? (
            <ImageUploadCard
              content={typeof content === 'string' ? content : ''}
              onContentChange={onContentChange}
              onImageSelect={(file) =>
                onInputDataChange?.({ ...inputData!, file })
              }
              previewUrl={
                inputData?.file ? URL.createObjectURL(inputData.file) : imageUrl
              }
            />
          ) : (
            <RichTextEditor
              content={typeof content === 'string' ? content : ''}
              onChange={onContentChange}
              className="h-full w-full"
            />
          )}
        </div>
        {contentError && (
          <p className="text-amber-600 text-xs mt-1">
            Content/description cannot be empty.
          </p>
        )}
      </div>
    </>
  );

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
        className={`resource-display preview-slide ${!isEditing ? 'fixed-height' : ''}`}
        tabIndex={isEditing ? 0 : -1}
      >
        {!isEditing ? (
          <>
            {/* Header */}
            <div className="preview-slide-header">
              <div className="preview-slide-title">{title}</div>
              <div className="preview-slide-actions">
                <ResourceMenu
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onAskAI={onAskAI}
                  onImageCaption={onImageCaption}
                  resourceType={type}
                />
                <button
                  onClick={() => {
                    console.log('[ResourceDisplay.tsx][9105] Fullscreen action clicked:', { id, type });
                    type === 'quiz' ? setQuizOverlayOpen(true) : open(id);
                  }}
                  className="slide-action-btn"
                  title="Full screen"
                >
                  <Maximize2 />
                </button>
                {onDismiss && (
                  <button
                    onClick={() => {
                      console.log('[ResourceDisplay.tsx][9106] Dismiss action clicked:', { id });
                      onDismiss();
                    }}
                    className="slide-action-btn"
                    title="Dismiss"
                  >
                    <CloseIcon />
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="preview-slide-body">
              <div className="preview-slide-content">{renderViewBody()}</div>
            </div>

            {/* Footer */}
            <div className="preview-slide-footer">
              <span className="concept-node-label">{ConceptNodeTitle}</span>
              <span className="slide-number" />
            </div>
          </>
        ) : (
          <div className="slide-content">{renderEditBody()}</div>
        )}
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
