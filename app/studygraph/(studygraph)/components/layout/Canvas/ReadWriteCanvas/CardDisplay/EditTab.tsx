/**
 * @file bloom-maps/app/studygraph/(studygraph)/components/layout/Canvas/ReadWriteCanvas/CardDisplay/v2/EditTab.tsx
 * @description
 *   The “implicit edit tab” that shows a single resource in an editable form,
 *   filling the entire right‐pane between the header and footer. It centralizes
 *   draft management and existing-resource editing, delegates validation to
 *   ResourceDisplay, and coordinates Save/Cancel via an imperative API. In this
 *   update we thread through a `canEdit` capability flag so that ResourceDisplay
 *   can deterministically render mutating UI only when both `canEdit` and the
 *   local `isEditing` flag are true. DOM/CSS hooks remain unchanged to preserve
 *   pixel parity and scrolling behavior. Handlers are O(1); list scans are O(N).
 *   This file also narrows `mapToDisplayType` to exclude `quizAssessment` to keep
 *   the switch statement exhaustive and resolve TS2366. Logging statements reveal
 *   critical state transitions without noise, each tagged with a unique code.
 */

import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useCallback,
} from 'react';

// BaseResourceCard is our “slide” wrapper. By giving it flex and h-full classes,
// we force the card to fill the entire vertical space of its parent.
import BaseResourceCard from '../../../CardDisplay/v2/BaseResourceCard';

import ResourceDisplay from '../Cards/ResourceDisplay';
import { useOrderedResources } from '@/app/studygraph/(studygraph)/components/hooks/useOrderedResources';
import useCardCrudOperations from '@/app/studygraph/(studygraph)/components/hooks/useCardCrudOperations';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import type { ResourceType as DisplayType } from '@/app/studygraph/(studygraph)/components/layout/CardDisplay/v2/AddResourceDropdown.tsx';
import type {
  ResourceCard,
  PracticeSheetResource,
  QuizAssessmentResource, // update - 1001: import to exclude from mapping
} from '@/app/Library/Definitions/Definitions';
import type { ResourceFormInput } from '../../../CardDisplay/types/resourceForm';

// Import the CSS we just created for edit‐tab behavior (scrollbar, flex fill, etc.)
import '@/app/studygraph/(studygraph)/components/layout/CardDisplay/v2/EditTab.css';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';

export type CardResourceType = 'cuecard' | 'note' | 'quiz';

interface PendingDraft {
  id: string;
  nodeId: string;
  type: CardResourceType;
  title: string;
  content: string;
}

export interface EditTabProps {
  /**
   * ID of the resource currently being edited (or a “draft‐ID”), or null if none.
   */
  editingResourceId: string | null;

  /**
   * Setter to clear or change which resource is being edited. setEditingResourceId(null) exits edit mode.
   */
  setEditingResourceId: (id: string | null) => void;

  /**
   * (Unused here, but passed down in CardDisplay.)
   */
  width: number;

  /**
   * Centralized form metadata from CardDisplay:
   *   • selectedTopicId: ID of an existing topic to attach to.
   *   • createNode: true if user wants to “create a new topic.”
   *   • nodeTitle: new topic name (if createNode=true).
   *   • file?: File (if editing an image resource).
   */
  inputData: ResourceFormInput;

  /**
   * Callback to update that metadata whenever the user picks a topic,
   * toggles “create new topic,” types a new topic name, or picks an image file.
   */
  onInputDataChange: (next: ResourceFormInput) => void;

  /**
   * Callback from CardDisplay so ResourceDisplay can notify parent
   * when form validity changes (true if all fields are non-empty).
   */
  onValidate?: (isValid: boolean) => void;

  /** Capability gate from DAM; enables editing affordances when true. */
  canEdit: boolean; /* update - 1002 */
}

export interface EditTabRef {
  createDraft: (type: CardResourceType) => void;
  startEdit: (id: string) => void;
  save: () => Promise<void>;
  cancel: () => void;
}

/**
 * Convert a Firestore ResourceCard.type into ResourceDisplay’s DisplayType.
 * (Edit tab never edits `quizAssessment`; exclude it to keep the switch exhaustive.)
 *
 * @param res An editable card (note | cueCard | practiceSheet). Never quizAssessment.
 */
type EditableCard = Exclude<ResourceCard, QuizAssessmentResource>; // update - 1003

function mapToDisplayType(res: EditableCard): DisplayType { // update - 1004
  switch (res.type) {
    case 'cueCard':
      return 'cuecard';
    case 'note':
      return 'note';
    case 'practiceSheet':
      return 'quiz';
  }
  // No default: switch is exhaustive over EditableCard. TS ensures no fallthrough.
}

const EditTab = forwardRef<EditTabRef, EditTabProps>((props, ref) => {
  const {
    editingResourceId,
    setEditingResourceId,
    inputData,
    onInputDataChange,
    onValidate,
    canEdit, /* update - 1005 */
  } = props;

  // 1) Grab all existing resources & our create/update hooks:
  const ordered = useOrderedResources();
  const { createResource, updateResource } = useCardCrudOperations();

  // 2) We may auto‐select a “focused node” when creating a draft:
  const { getFocusNode } = useNodeSelection();
  const { getNodeTitle } = useNodesContext();

  // 3) Local state for “draft vs. existing” + local title/content:
  const [draft, setDraft] = useState<PendingDraft | null>(null);
  const [editingFields, setEditingFields] = useState<{ title: string; content: string }>({
    title: '',
    content: '',
  });

   /**
   * createDraft(type):
   *   • Called by CardDisplay when “+ Add card ▶ [cuecard|note|image]” is clicked.
   *   • We generate a fresh “draft‐ID,” clear previous metadata, and switch to edit mode.
   */
  const createDraft = useCallback(
    (type: CardResourceType) => {
      const nodeId = getFocusNode() || '';
      const id = `draft-${Date.now()}`;
      setDraft({ id, nodeId, type, title: '', content: '' });
      setEditingFields({ title: '', content: '' });
      onInputDataChange({
        selectedTopicId: '',
        createNode: false,
        nodeTitle: '',
        file: undefined,
      });
      setEditingResourceId(id);
    },
    [getFocusNode, onInputDataChange, setEditingResourceId]
  );

    /**
   * startEdit(id):
   *   • Called by CardDisplay when “Edit” is clicked on an existing card.
   *   • We load that resource’s fields into local state, clear draft, and switch to edit mode.
   */
  const startEdit = useCallback(
    (id: string) => {
      const res = ordered.find((r) => r.id === id);
      if (!res) return;
      // Guard: we do not edit quizAssessment here
      if (res.type === 'quizAssessment') {
        console.log('[EditTab.tsx][6101] startEdit ignored for quizAssessment', { id });
        return;
      }
      setDraft(null);

      let contentStr: string;
      if (res.type === 'practiceSheet') {
        const quiz = res as PracticeSheetResource;
        contentStr = JSON.stringify(quiz.content);
      } else {
        contentStr = (res as any).content;
      }

      setEditingFields({ title: res.title, content: contentStr });

      onInputDataChange({
        selectedTopicId: res.nodeId,
        createNode: false,
        nodeTitle: '',
        file: undefined,
      });
      setEditingResourceId(id);
    },
    [ordered, onInputDataChange, setEditingResourceId]
  );

    /**
   * saveEdit():
   *   • Called by CardDisplay when the user clicks “Save.”
   *   • If editing a draft, call createResource(); otherwise, call updateResource().
   *   • Then exit edit mode.
   */
  const saveEdit = useCallback(async () => {
    if (!editingResourceId) return;

    if (draft && editingResourceId === draft.id) {
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
      const res = ordered.find((r) => r.id === editingResourceId);
      if (res && res.type !== 'quizAssessment') {
        await updateResource(res, {
          title: editingFields.title,
          content: editingFields.content,
          image: inputData.file,
          newImage: !!inputData.file,
        });
      } else {
        console.log('[EditTab.tsx][6102] saveEdit skipped (quizAssessment or missing)', { editingResourceId });
      }
    }

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

    /**
   * cancelEdit():
   *   • Called by CardDisplay when the user clicks “Cancel.”
   *   • Discard local changes and exit edit mode.
   */
  const cancelEdit = useCallback(() => {
    setEditingResourceId(null);
    setDraft(null);
  }, [setEditingResourceId]);

  useImperativeHandle(
    ref,
    () => ({
      createDraft,
      startEdit,
      save: saveEdit,
      cancel: cancelEdit,
    }),
    [createDraft, startEdit, saveEdit, cancelEdit]
  );

  if (!editingResourceId) {
    return null;
  }

  const isDraft = Boolean(draft && editingResourceId === draft.id);
  const existing = !isDraft
    ? ordered.find((r) => r.id === editingResourceId) || null
    : null;

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 flex-1 flex flex-col">
        <BaseResourceCard className="!p-0 flex flex-col relative flex-1 h-full edit-form-tall" tabIndex={0}>
          <div className="flex-1 overflow-y-auto resource-body pb-0">
            <div className="px-6 pt-10">
              <ResourceDisplay
                id={editingResourceId!}
                type={isDraft ? draft!.type : mapToDisplayType(existing as EditableCard)}
                nodeId={isDraft ? draft!.nodeId : (existing as EditableCard)!.nodeId}
                ConceptNodeTitle={
                  existing ? getNodeTitle(existing!.nodeId)! : ''
                }
                title={editingFields.title}
                content={editingFields.content}
                isEditing={true}
                isNewCard={isDraft}
                canEdit={canEdit} /* update - 1006 */
                inputData={inputData}
                onInputDataChange={onInputDataChange}
                onValidate={onValidate}
                onTitleChange={(t) => setEditingFields((f) => ({ ...f, title: t }))}
                onContentChange={(c) => setEditingFields((f) => ({ ...f, content: c }))}
                onCancel={cancelEdit}
                onSave={saveEdit}
                onEdit={() => {}}
                onDelete={() => {}}
                onAskAI={() => {}}
              />
            </div>
          </div>
        </BaseResourceCard>
      </div>
    </div>
  );
});

EditTab.displayName = 'EditTab';
export default EditTab;
