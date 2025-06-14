// EditTab.tsx

/**
 * @file EditTab.tsx
 * @description
 *   The "implicit edit tab" that shows exactly one resource in a write-only form.
 *   Responsibilities after patch:
 *     - Maintain title/content state for the resource itself.
 *     - Receive centralized form metadata (selectedTopicId, createNode, nodeTitle, file)
 *       from the parent (CardDisplay).
 *     - Forward metadata, change handlers, and new validation callbacks into ResourceDisplay.
 *     - Provide imperatives:
 *         • createDraft(type) to start a new draft
 *         • startEdit(id) to load an existing resource
 *         • save() to persist if ResourceDisplay says valid
 *         • cancel() to abort
 *         • attemptSave() to request ResourceDisplay run its validation and save logic
 *         • isFormValid() to let CardDisplay know if all fields are valid
 */

import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import ResourceDisplay, { ResourceType as DisplayType } from './ResourceDisplay';
import { useOrderedResources } from '@/app/studygraph/(studygraph)/components/hooks/useOrderedResources';
import useCardCrudOperations from '@/app/studygraph/(studygraph)/components/hooks/useCardCrudOperations';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import type {
  ResourceCard,
  PictureResource,
  PracticeSheetResource,
} from '@/app/Library/Definitions/Definitions';
import type { ResourceFormInput } from './types/resourceForm';
import "@/app/studygraph/(studygraph)/components/layout/CardDisplay/notesTab.css";

export type CardResourceType = 'cuecard' | 'note' | 'image' | 'quiz';

interface PendingDraft {
  id: string;
  nodeId: string;
  type: CardResourceType;
  title: string;
  content: string;
}

export interface EditTabProps {
  editingResourceId: string | null;
  setEditingResourceId: (id: string | null) => void;
  currentTopicTitle: string;
  width: number;

  /** Centralized form metadata from CardDisplay */
  inputData: ResourceFormInput;
  onInputDataChange: (next: ResourceFormInput) => void;

  /**
   * Notifies CardDisplay whenever ResourceDisplay’s validity toggles.
   * @param isValid true if topic/title/content are all non-empty.
   */
  onChildValidityChange?: (isValid: boolean) => void;
}

export interface EditTabRef {
  createDraft: (type: CardResourceType) => void;
  startEdit: (id: string) => void;
  save: () => Promise<void>;
  cancel: () => void;
  /** Ask ResourceDisplay to run validation & save if valid */
  attemptSave: () => void;
  /** Return true if ResourceDisplay deems the form valid */
  isFormValid: () => boolean;
}

/** Map ResourceCard.type to ResourceDisplay's type prop */
function mapToDisplayType(res: ResourceCard): DisplayType {
  switch (res.type) {
    case 'cueCard':     return 'cuecard';
    case 'note':        return 'note';
    case 'picture':     return 'image';
    case 'practiceSheet': return 'quiz';
  }
}

const EditTab = forwardRef<EditTabRef, EditTabProps>(({
  editingResourceId,
  setEditingResourceId,
  currentTopicTitle,
  width,
  inputData,
  onInputDataChange,
  onChildValidityChange,
}, ref) => {
  const ordered = useOrderedResources();
  const { createResource, updateResource } = useCardCrudOperations();
  const { getFocusNode } = useNodeSelection();

  // State for the resource’s own title & content
  const [draft, setDraft] = useState<PendingDraft | null>(null);
  const [editingFields, setEditingFields] = useState<{ title: string; content: string }>({
    title: '',
    content: '',
  });

  // Track whether ResourceDisplay says “form valid”
  const [childIsFormValid, setChildIsFormValid] = useState(false);
  // Flag to force ResourceDisplay to run its save/validation logic
  const [forceSaveFlag, setForceSaveFlag] = useState(false);

  const tabRef = useRef<HTMLDivElement>(null);
  const [isHoveringTab, setIsHoveringTab] = useState(false);
  const [isHoveringCard, setIsHoveringCard] = useState(false);

  const handleTabMouseEnter = () => setIsHoveringTab(true);
  const handleTabMouseLeave = () => setIsHoveringTab(false);
  const handleCardMouseEnter = () => setIsHoveringCard(true);
  const handleCardMouseLeave = () => setIsHoveringCard(false);

  const getScrollbarClass = () => {
    if (!isHoveringTab || isHoveringCard) return 'scrollbar-hidden';
    return 'scrollbar-visible';
  };

  /** Create a new draft resource */
  const createDraft = useCallback((type: CardResourceType) => {
    const nodeId = getFocusNode() || '';
    const id = `draft-${Date.now()}`;
    setDraft({ id, nodeId, type, title: '', content: '' });
    setEditingFields({ title: '', content: '' });
    // Clear metadata for fresh form
    onInputDataChange({ selectedTopicId: '', createNode: false, nodeTitle: '', file: undefined });
    setEditingResourceId(id);
  }, [getFocusNode, onInputDataChange, setEditingResourceId]);

  /** Load an existing resource into editingFields */
  const startEdit = useCallback((id: string) => {
    const res = ordered.find(r => r.id === id);
    if (!res) return;
    setDraft(null);

    let contentStr: string;
    if (res.type === 'picture') {
      const pic = res as PictureResource;
      contentStr = pic.description ? JSON.stringify(pic.description) : '';
    } else if (res.type === 'practiceSheet') {
      const quiz = res as PracticeSheetResource;
      contentStr = JSON.stringify(quiz.content);
    } else {
      contentStr = (res as any).content;
    }

    setEditingFields({ title: res.title, content: contentStr });
    // Reset metadata to defaults; user will reselect or reuse existing topic
    onInputDataChange({ selectedTopicId: '', createNode: false, nodeTitle: '', file: undefined });
    setEditingResourceId(id);
  }, [ordered, onInputDataChange, setEditingResourceId]);

  /** Persist either a new draft or an existing edit */
  const saveEdit = useCallback(async () => {
    if (!editingResourceId) return;

    if (draft && editingResourceId === draft.id) {
      // New resource creation
      await createResource({
        nodeId: inputData.selectedTopicId || draft.nodeId,
        createNode: inputData.createNode,
        nodeTitle: inputData.nodeTitle,
        type: draft.type,
        title: editingFields.title,
        content: editingFields.content,
        image: inputData.file,
      });
    } else {
      // Existing resource update
      const res = ordered.find(r => r.id === editingResourceId);
      if (res) {
        await updateResource(res, {
          title: editingFields.title,
          content: editingFields.content,
          image: inputData.file,
          newImage: !!inputData.file,
        });
      }
    }

    // Exit edit mode
    setEditingResourceId(null);
    setDraft(null);
  }, [
    editingResourceId,
    draft,
    editingFields,
    inputData,
    createResource,
    updateResource,
    ordered,
    setEditingResourceId,
  ]);

  /** Cancel and clear any draft or edits */
  const cancelEdit = useCallback(() => {
    setEditingResourceId(null);
    setDraft(null);
  }, [setEditingResourceId]);

  // Notify parent (CardDisplay) of validity changes in ResourceDisplay
  useEffect(() => {
    if (onChildValidityChange) {
      onChildValidityChange(childIsFormValid);
    }
  }, [childIsFormValid, onChildValidityChange]);

  // Expose our imperative API to parent
  useImperativeHandle(ref, () => ({
    createDraft,
    startEdit,
    save: saveEdit,
    cancel: cancelEdit,
    attemptSave: () => {
      // Ask ResourceDisplay to run its handleSaveClick
      setForceSaveFlag(true);
      // Reset immediately so future toggles fire
      setTimeout(() => setForceSaveFlag(false), 0);
    },
    isFormValid: () => childIsFormValid,
  }), [createDraft, startEdit, saveEdit, cancelEdit, childIsFormValid]);

  // Nothing to render if not editing
  if (!editingResourceId) return null;

  const isDraft = Boolean(draft && editingResourceId === draft.id);
  const existing = !isDraft
    ? ordered.find(r => r.id === editingResourceId) || null
    : null;

  return (
    <div
      ref={tabRef}
      className={`notes-tab-container ${getScrollbarClass()}`}
      onMouseEnter={handleTabMouseEnter}
      onMouseLeave={handleTabMouseLeave}
    >
      <div
        onMouseEnter={handleCardMouseEnter}
        onMouseLeave={handleCardMouseLeave}
      >
        <ResourceDisplay
          id={editingResourceId}
          type={isDraft ? draft!.type : mapToDisplayType(existing!)}
          nodeId={isDraft ? draft!.nodeId : existing!.nodeId}
          ConceptNodeTitle={currentTopicTitle}
          title={editingFields.title}
          content={editingFields.content}
          imageUrl={!isDraft && existing?.type === 'picture'
            ? (existing as PictureResource).imageUrl
            : undefined}
          isEditing={true}
          isNewCard={isDraft}
          /** Pass controlled metadata into ResourceDisplay */
          inputData={inputData}
          onInputDataChange={onInputDataChange}

          onTitleChange={t => setEditingFields(f => ({ ...f, title: t }))}
          onContentChange={c => setEditingFields(f => ({ ...f, content: c }))}
          onCancel={cancelEdit}
          onSave={saveEdit}

          // Noops in edit mode:
          onEdit={() => {}}
          onDelete={() => {}}
          onAskAI={() => {}}
          onImageCaption={() => {}}

          /** New props to integrate validation workflow */
          onValidityChange={setChildIsFormValid}
          forceSaveAttempt={forceSaveFlag}
        />
      </div>
    </div>
  );
});

EditTab.displayName = 'EditTab';

export default EditTab;
