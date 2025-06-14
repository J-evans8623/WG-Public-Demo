/**
 * @file EditTab.tsx
 * @description
 *   The “implicit edit tab” that shows a single resource in an editable form,
 *   filling the entire right‐pane between the header and footer.
 *   Responsibilities:
 *     - Maintain local state (draft vs. existing resource) for title & content.
 *     - Provide an imperative API (createDraft, startEdit, save, cancel) to CardDisplay.
 *     - Wrap ResourceDisplay in a “white slide” card that:
 *         1) Is a flex container with height:100% (fills its parent).
 *         2) Contains an inner flex‐1, overflow‐auto area for scrolling if content is large.
 *         3) Keeps consistent padding around inputs.
 *         4) Ensures there is left/right padding so the card does not touch the panel border.
 *     - Pass down `onValidate` from parent so ResourceDisplay can notify CardDisplay of form validity.
 */

import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useCallback,
} from 'react';

// BaseResourceCard is our “slide” wrapper. By giving it flex and h-full classes,
// we force the card to fill the entire vertical space of its parent.
import BaseResourceCard from './BaseResourceCard';

import ResourceDisplay, { ResourceType as DisplayType } from './ResourceDisplay';
import { useOrderedResources } from '@/app/studygraph/(studygraph)/components/hooks/useOrderedResources';
import useCardCrudOperations from '@/app/studygraph/(studygraph)/components/hooks/useCardCrudOperations';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';

import type {
  ResourceCard,
  PictureResource,
  PracticeSheetResource,
} from '@/app/Library/Definitions/Definitions';
import type { ResourceFormInput } from '../types/resourceForm';

// Import the CSS we just created for edit‐tab behavior (scrollbar, flex fill, etc.)
import './EditTab.css';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';

export type CardResourceType = 'cuecard' | 'note' | 'image' | 'quiz';

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
}

export interface EditTabRef {
  /**
   * Called by CardDisplay when “+ Add card ▶ [cuecard|note|image]” is clicked.
   * We generate a new “draft ID,” clear out old metadata, and switch to edit mode.
   */
  createDraft: (type: CardResourceType) => void;

  /**
   * Called by CardDisplay when “Edit” is clicked on an existing resource.
   * We load that resource’s fields into local state and switch to edit mode.
   */
  startEdit: (id: string) => void;

  /**
   * Called by CardDisplay’s “Save” button. We either create a new resource
   * or update an existing one, then exit edit mode.
   */
  save: () => Promise<void>;

  /**
   * Called by CardDisplay’s “Cancel” button. We discard any local changes
   * and exit edit mode.
   */
  cancel: () => void;
}

/**
 * Convert a Firestore ResourceCard.type (e.g. 'cueCard', 'note', 'picture', 'practiceSheet')
 * into ResourceDisplay’s “type” prop: 'cuecard' | 'note' | 'image' | 'quiz'.
 */
function mapToDisplayType(res: ResourceCard): DisplayType {
  switch (res.type) {
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

const EditTab = forwardRef<EditTabRef, EditTabProps>((props, ref) => {
  const {
    editingResourceId,
    setEditingResourceId,
    inputData,
    onInputDataChange,
    onValidate,
  } = props;

  // 1) Grab all existing resources & our create/update hooks:
  const ordered = useOrderedResources();
  const { createResource, updateResource } = useCardCrudOperations();

  // 2) We may auto‐select a “focused node” when creating a draft:
  const { getFocusNode } = useNodeSelection();
  const { getNodeTitle } = useNodesContext();

  // 3) Local state for “draft vs. existing” + local title/content:
  const [draft, setDraft] = useState<PendingDraft | null>(null);
  const [editingFields, setEditingFields] = useState<{
    title: string;
    content: string;
  }>({
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
      // Clear old metadata so user must pick/create a new topic:
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
      onInputDataChange({
        selectedTopicId: '',
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
      // Create new resource
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
      // Update existing resource
      const res = ordered.find((r) => r.id === editingResourceId);
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

  /**
   * cancelEdit():
   *   • Called by CardDisplay when the user clicks “Cancel.”
   *   • Discard local changes and exit edit mode.
   */
  const cancelEdit = useCallback(() => {
    setEditingResourceId(null);
    setDraft(null);
  }, [setEditingResourceId]);

  // Expose the imperative API to CardDisplay (via ref):
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

  // If no resource is selected for editing, render nothing:
  if (!editingResourceId) {
    return null;
  }

  // Determine if this is a brand‐new draft vs. an existing resource:
  const isDraft = Boolean(draft && editingResourceId === draft.id);
  const existing = !isDraft
    ? ordered.find((r) => r.id === editingResourceId) || null
    : null;

  return (
    /**
     * ─────────────────────────────────────────────────────────────────────────
     * We wrap the entire BaseResourceCard in a flex container so that
     * the card is horizontally padded by 16px on each side, matching the
     * same spacing used in NotesTab for all cards.
     *
     * The BaseResourceCard itself has:
     *   • !p-0         → remove any default padding
     *   • flex flex-col → treat as a vertical flex container
     *   • relative     → allow absolute children
     *   • flex-1 h-full → force to 100% height of parent
     *   • edit-form-tall → ensure height:100% via EditTab.css
     *
     * Without both “flex-1 h-full” and “edit-form-tall,” the card collapses.
     * With them, it fills the full height of the absolute‐position parent
     * provided by CardDisplay.
     * ─────────────────────────────────────────────────────────────────────────
     */
    <div className="h-full flex flex-col">
      <div className="px-4 flex-1 flex flex-col">
        <BaseResourceCard
          className="!p-0 flex flex-col relative flex-1 h-full edit-form-tall"
          tabIndex={0}
        >
          {/**
            * ──────────────────────────────────────────────────────────────────────
            * Inner wrapper that holds the editable form. Because the parent card is
            * now a flex container with fixed height, we can simply use “flex-1
            * overflow-y-auto” here: the form will fill all of the card’s height,
            * and scroll internally if the content grows larger than the view.
            *
            *   • flex-1           → expand to fill the card’s vertical space
            *   • overflow-y-auto → allow internal scrolling when content is tall
            *   • resource-body   → optional class for custom scrollbar CSS
            *   • pb-0            → no bottom padding (we do not render a card-footer)
            * ──────────────────────────────────────────────────────────────────────
            */}
          <div className="flex-1 overflow-y-auto resource-body pb-0">
            {/**
              * ────────────────────────────────────────────────────────────────────
              * Add top/side padding so form fields don’t hug the card edges.
              * The original code used “px-6 pt-10”; we replicate that here.
              * ────────────────────────────────────────────────────────────────────
              */}
            <div className="px-6 pt-10">
              <ResourceDisplay
                id={editingResourceId!}
                type={isDraft ? draft!.type : mapToDisplayType(existing!)}
                nodeId={isDraft ? draft!.nodeId : existing!.nodeId}
                ConceptNodeTitle={
                  existing ? getNodeTitle(existing!.nodeId)! : ''
                }
                title={editingFields.title}
                content={editingFields.content}
                imageUrl={
                  !isDraft && existing?.type === 'picture'
                    ? (existing as PictureResource).imageUrl
                    : undefined
                }
                isEditing={true}
                isNewCard={isDraft}
                /** Pass the centralized metadata (topic/file) down */
                inputData={inputData}
                onInputDataChange={onInputDataChange}
                /** Pass validation callback so ResourceDisplay can notify parent */
                onValidate={onValidate}
                /** Controlled callbacks for title & content */
                onTitleChange={(t) =>
                  setEditingFields((f) => ({ ...f, title: t }))
                }
                onContentChange={(c) =>
                  setEditingFields((f) => ({ ...f, content: c }))
                }
                onCancel={cancelEdit}
                onSave={saveEdit}
                /** No-ops during edit mode */
                onEdit={() => {}}
                onDelete={() => {}}
                onAskAI={() => {}}
                onImageCaption={() => {}}
              />
            </div>
          </div>
          {/**
            * In edit mode, we do NOT render any “read‐mode footer” inside the card.
            * CardDisplay’s external ActionFooter (Cancel / Save) remains visible at the bottom.
            */}
        </BaseResourceCard>
      </div>
    </div>
  );
});

EditTab.displayName = 'EditTab';
export default EditTab;
