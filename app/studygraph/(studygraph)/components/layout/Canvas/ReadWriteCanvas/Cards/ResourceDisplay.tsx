// bloom-maps/app/studygraph/(studygraph)/components/layout/Canvas/ReadWriteCanvas/Cards/ResourceDisplay.tsx
/**
 * @file bloom-maps/app/studygraph/(studygraph)/components/layout/Canvas/ReadWriteCanvas/Cards/ResourceDisplay.tsx
 * @description
 *   Unified read/write Resource Display component for cue cards, notes, and quizzes. This file
 *   merges the prior “editable” and “read-only” behaviors into a single, capability-gated
 *   component via a new `canEdit` property. When `canEdit` is true, mutating actions (Edit,
 *   Delete, Ask AI, and Version History Restore) are available; when false, only viewer-safe
 *   actions (Fullscreen and optional Dismiss) are shown. The component preserves all original
 *   branded styling, DOM class names (e.g., `resource-display`, `preview-slide-*`), and layout
 *   semantics to avoid visual regressions. It also standardizes quiz metadata (parentQuizId,
 *   mapId) for consistent analytics, and scopes edit-form validation only to sessions where
 *   editing is truly enabled. Targeted console statements aid observability without noise.
 *   The implementation favors O(1) interactivity; O(N) operations are bounded to topic search.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Maximize2,
  ChevronsUpDown,
  Check,
  X as CloseIcon,
  PlusCircle,
  RotateCcw, /* update - 1: add restore icon for Version History */
} from 'lucide-react';
import BaseResourceCard from '../../../CardDisplay/v2/BaseResourceCard';
import ResourceMenu from '../../../CardDisplay/ResourceMenu';
import CueCard from '../../../CardDisplay/Cards/CueCard';
import NoteCard from '../../../CardDisplay/Cards/NoteCard';
import QuizCard from '../Cards/QuizCard';
import QuizOverlay from '../Overlays/QuizOverlay';
import RichTextEditor from '@/components/RichTextEditor';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { QuizType, IQuizQuestion, ResourceCard } from '@/app/Library/Definitions/Definitions'; /* update - 2: import ResourceCard discriminator for restore */
import type { ResourceFormInput } from '../../../CardDisplay/types/resourceForm';
import '@/app/studygraph/(studygraph)/components/layout/CardDisplay/v2/resourceDisplay.css';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useVersionHistory } from '@/app/Library/Context/VersionHistoryContext'; /* update - 3: version history hook for Restore */
import type { ResourceType } from '@/app/studygraph/(studygraph)/components/layout/CardDisplay/v2/AddResourceDropdown.tsx';
/* ------------------------------------------------------------------------------------------------
 * Types
 * ---------------------------------------------------------------------------------------------- */

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

  /* capability gate: when false, component is read-only and hides mutating controls */
  canEdit?: boolean; /* update - 4: NEW capability flag to unify RO/RW */

  /* controlled metadata (edit-mode only) */
  inputData?: ResourceFormInput;
  onInputDataChange?: (next: ResourceFormInput) => void;

  /* callbacks (made optional so read views don’t need to stub them) */
  onTitleChange?: (t: string) => void;  /* update - 5 */
  onContentChange?: (c: string) => void; /* update - 6 */
  onCancel?: () => void; /* update - 7 */
  onSave?: () => void; /* update - 8 */
  onEdit?: () => void; /* update - 9 */
  onDelete?: () => void; /* update - 10 */
  onAskAI?: () => void; /* update - 11 */
  onDismiss?: () => void;

  /**
   * Called whenever the validity of the form changes.
   * Parent can use this to enable/disable external Save button.
   */
  onValidate?: (isValid: boolean) => void;
}

/**
 * mapToCardType
 * Responsibility: Convert this component's ResourceType union to the ResourceCard.type
 * discriminator used by Version History restore. This function ensures we create a well-typed
 * payload for `restoreResource`. It must remain O(1) and handle only the supported triad of
 * resource types, returning the specific discriminator string expected downstream.
 */
function mapToCardType(type: ResourceType): ResourceCard['type'] { /* update - 12 */
  switch (type) {
    case 'cuecard':
      return 'cueCard';
    case 'note':
      return 'note';
    case 'quiz':
      return 'practiceSheet';
  }
}

/**
 * makeRestoreCard
 * Responsibility: Build a ResourceCard payload for Version History restore using the current
 * props. This safely converts `content` to a serializable string and carries core identifiers.
 * It is O(1) and side-effect free; consumers can pass its result to `restoreResource`.
 */
function makeRestoreCard(args: {
  id: string;
  nodeId?: string;
  type: ResourceType;
  title: string;
  content: string | object;
}): ResourceCard { /* update - 13 */
  const { id, nodeId, type, title, content } = args;
  return {
    id,
    nodeId: nodeId || '',
    type: mapToCardType(type),
    title,
    content: typeof content === 'string' ? content : JSON.stringify(content),
  } as ResourceCard;
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
  canEdit = false, /* update - 14: default to false per proposal */

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
  const { activeConceptMapId } = useLessonModule();

  const { isHistoryOpen, restoreResource } = useVersionHistory(); /* update - 15 */

  const [quizOverlayOpen, setQuizOverlayOpen] = useState(false);
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cueFlipped, setCueFlipped] = useState(false);
  const topicSelectorRef = useRef<HTMLDivElement>(null);

  // ── Validation flags for edit mode ─────────────────────────────────
  const [topicError, setTopicError] = useState(false);
  const [titleError, setTitleError] = useState(false);
  const [contentError, setContentError] = useState(false);

  /* update - 16: single gate for edit affordances */
  const editingEnabled = Boolean(canEdit && isEditing);

  useEffect(() => {
    // Step 1: ensure external save buttons are disabled when we leave an editable state
    if (!editingEnabled && onValidate) {
      console.log('[ResourceDisplay.tsx][9001] editingEnabled=false → onValidate(false)', {
        id,
        canEdit,
        isEditing,
      });
      onValidate(false);
    }
  }, [editingEnabled, onValidate, id, canEdit, isEditing]); /* update - 17 */

  /* ──────────────────────────────────────────────────────────────────────────── */
  /* 2) FOCUS‐NODE AUTO‐SELECT                                                    */
  /* ──────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (
      editingEnabled && /* update - 18 */
      isNewCard &&
      inputData &&
      !inputData.selectedTopicId &&
      !inputData.createNode &&
      onInputDataChange
    ) {
      const focus = getFocusNode();
      if (focus) {
        console.log('[ResourceDisplay.tsx][9002] Auto-selecting focus node on new card', {
          id,
          focus,
        });
        onInputDataChange({ ...inputData, selectedTopicId: focus });
      }
    }
  }, [editingEnabled, isNewCard, inputData, onInputDataChange, getFocusNode, id]);

  /* ──────────────────────────────────────────────────────────────────────────── */
  /* 3) CLICK‐OUTSIDE FOR DROPDOWN                                                */
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
  /* 4) HELPERS FOR TOPIC SELECTION                                               */
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
  /* 5) VALIDATION & FORM‐STATE                                                   */
  /* ──────────────────────────────────────────────────────────────────────────── */
  // Convert content prop (string | object) to a plain string for validation
  const contentString =
    typeof content === 'string' ? content : JSON.stringify(content);

  // The form is valid only if a topic is selected/created, title is non-empty, and content is non-empty
  const isFormValid = Boolean(
    (inputData?.selectedTopicId?.trim() || inputData?.createNode) &&
      title.trim() !== '' &&
      contentString.trim() !== ''
  );

  // Notify parent whenever form validity changes (only meaningful in edit sessions)
  useEffect(() => {
    if (editingEnabled && onValidate) {
      console.log('[ResourceDisplay.tsx][9003] onValidate(editingEnabled=true)', {
        id,
        isFormValid,
      });
      onValidate(isFormValid);
    }
  }, [editingEnabled, isFormValid, onValidate, id]); /* update - 19 */

  /* ──────────────────────────────────────────────────────────────────────────── */
  /* 6) RENDER VIEW BODY (INCLUDES CUECARD CENTERING)                             */
  /* ──────────────────────────────────────────────────────────────────────────── */

  /**
   * renderViewBody
   * Responsibility: Render the non-edit (read) view body for cue cards, notes, and quizzes while
   * preserving the original centering wrappers and visual layout. It normalizes quiz content by
   * parsing JSON if necessary and passing consistent metadata (parentQuizId, mapId). Execution
   * is O(1); JSON parse is bounded by payload size and guarded with try/catch for resilience.
   */
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
            {...commonViewProps}
            content={{ quizType, quizContent: quizData }}
            parentQuizId={id} /* update - 20 */
            mapId={activeConceptMapId} /* update - 21 */
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
            <CueCard title={title} content={String(content)} flipped={cueFlipped} />
          </div>
        );
    }
  };

  /* ──────────────────────────────────────────────────────────────────────────── */
  /* 7) RENDER EDIT‐MODE BODY                                                     */
  /* ──────────────────────────────────────────────────────────────────────────── */

  /**
   * renderEditBody
   * Responsibility: Render the mutating form (topic selector, title, content) when editing is
   * permitted by `canEdit && isEditing`. Displays simple inline validation warnings tied to
   * the local error flags. Execution is O(N) only for topic list filtering during search;
   * all other logic is O(1). This function is pure-UI and side-effect free.
   */
  const renderEditBody = () => (
    <>
      <div className="mb-6">
        {!isNewCard ? (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Topic
            </label>
            <div className="w-full px-3 py-2 border rounded-md bg-gray-50 text-gray-600">
              {ConceptNodeTitle}
            </div>
          </>
        ) : (
          <>
            {/* Topic selector / create new */}
            <div className="mb-6" ref={topicSelectorRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {inputData?.createNode ? 'New Topic Name' : 'Select Topic'}
              </label>

              {inputData?.createNode ? (
                <>
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
                    <p className="text-amber-600 text-xs mt-1">Select or create a topic.</p>
                  )}
                </>
              ) : (
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
                    <p className="text-amber-600 text-xs mt-1">Select or create a topic.</p>
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
                            onInputDataChange?.({
                              ...inputData!,
                              createNode: true,
                              nodeTitle: '',
                              selectedTopicId: '',
                            });
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
                                onInputDataChange?.({
                                  ...inputData!,
                                  createNode: false,
                                  nodeTitle: '',
                                  selectedTopicId: n.id,
                                });
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
              )}
            </div>
          </>
        )}
      </div>

      {/* Title */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange?.(e.target.value)} /* update - 22 */
          className="w-full border rounded px-3 py-2"
        />
        {titleError && (
          <p className="text-amber-600 text-xs mt-1">Title cannot be empty.</p>
        )}
      </div>

      {/* Content */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Content
        </label>
        <div className="h-[300px] overflow-y-auto border rounded">
          <RichTextEditor
            content={typeof content === 'string' ? content : ''}
            onChange={(c) => onContentChange?.(c)} /* update - 23 */
            className="h-full w-full"
          />
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
  /* 8) FINAL JSX                                                                 */
  /* ──────────────────────────────────────────────────────────────────────────── */
  return (
    <>
      <BaseResourceCard
        className={`resource-display preview-slide ${!editingEnabled ? 'fixed-height' : ''}`} /* update - 24 */
        tabIndex={editingEnabled ? 0 : -1} /* update - 25 */
      >
        {!editingEnabled ? (
          <>
            {/* Header */}
            <div className="preview-slide-header">
              <div className="preview-slide-title">{title}</div>
              <div className="preview-slide-actions">
                {/* update - 26: gate mutating ResourceMenu behind editingEnabled */}
                {editingEnabled && (
                  <ResourceMenu
                    onEdit={() => {
                      console.log('[ResourceDisplay.tsx][9004] Edit requested', {
                        id,
                        canEdit,
                        isEditing,
                      });
                      onEdit?.();
                    }}
                    onDelete={() => {
                      console.log('[ResourceDisplay.tsx][9005] Delete requested', {
                        id,
                        canEdit,
                        isEditing,
                      });
                      onDelete?.();
                    }}
                    onAskAI={() => {
                      console.log('[ResourceDisplay.tsx][9006] AskAI requested', {
                        id,
                        canEdit,
                        isEditing,
                      });
                      onAskAI?.();
                    }}
                    resourceType={type}
                  />
                )}

                {/* update - 27: Version History Restore appears only when editingEnabled && isHistoryOpen */}
                {editingEnabled && isHistoryOpen && (
                  <button
                    className="slide-action-btn"
                    title="Restore resource"
                    onClick={() => {
                      const payload = makeRestoreCard({
                        id,
                        nodeId,
                        type,
                        title,
                        content,
                      });
                      console.log('[ResourceDisplay.tsx][9007] Restore clicked', {
                        id,
                        payloadSummary: {
                          id: payload.id,
                          nodeId: payload.nodeId,
                          type: payload.type,
                          title: payload.title,
                        },
                      });
                      restoreResource(payload);
                    }}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}

                <button
                  onClick={() => {
                    console.log('[ResourceDisplay.tsx][9008] Fullscreen clicked', {
                      id,
                      type,
                    });
                    type === 'quiz' ? setQuizOverlayOpen(true) : open(id);
                  }}
                  className="slide-action-btn"
                  title="Full screen"
                >
                  <Maximize2 />
                </button>

                {/* update - 28: Dismiss is only meaningful in edit sessions; hide otherwise */}
                {editingEnabled && onDismiss && (
                  <button
                    onClick={() => {
                      console.log('[ResourceDisplay.tsx][9009] Dismiss clicked', { id });
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

      {/* QuizOverlay: Same as main ResourceDisplay */}
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
          isAssessment={false}
        />
      )}
    </>
  );
};

export default ResourceDisplay;
