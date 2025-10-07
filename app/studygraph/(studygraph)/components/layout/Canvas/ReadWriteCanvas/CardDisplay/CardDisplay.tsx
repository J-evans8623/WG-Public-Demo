// bloom-maps/app/studygraph/(studygraph)/components/layout/Canvas/ReadWriteCanvas/CardDisplay/CardDisplay.tsx
/**
 * @file bloom-maps/app/studygraph/(studygraph)/components/layout/Canvas/ReadWriteCanvas/CardDisplay/CardDisplay.tsx
 * @description
 * This file implements the top-level right-hand resource panel used throughout the StudyGraph canvas.
 * It renders the unified header, content tabs (Notes / Chat / Edit), and the sticky footer actions.
 * CardDisplay is the single authority for computing capability: it reads the Document Access Manager (DAM)
 * via `useDocumentAccessMode()` and derives a boolean `canEdit` using `isEditReady(mode, status)`.
 * This one flag is drilled into child components (`UnifiedHeader`, `NotesTab`, `EditTab`, `ActionFooter`)
 * so mutating affordances are universally gated without duplicating hook logic down the tree. We preserve
 * all DOM structure and CSS hooks for pixel-parity, add concise console logs at high-signal checkpoints,
 * and guard handlers with early returns to keep all per-event work O(1). Save is disabled unless both
 * `canEdit` and the form validity conditions hold. Rendering remains O(1) per event; lists are O(N).
 *
 * Responsibilities:
 *  1) Compute and memoize `canEdit` once at the root using DAM (authoritative capability).
 *  2) Drive the unified header and tabs while preserving existing styling and layout invariants.
 *  3) Guard create/edit/save/cancel interactions with early returns when `!canEdit` or invalid form.
 *  4) Emit purposeful logs with stable file+code tags for observability in production triage.
 *  5) Maintain O(1) event handlers; O(N) work is limited to operations performed by child components.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react'; 
import NotesTab from './NotesTab';
import ChatTab from '../../../CardDisplay/v2/ChatTab';
import EditTab, { EditTabRef } from './EditTab';
import UnifiedHeader from './UnifiedHeader';
import ActionFooter from './ActionFooter';
import { useSelectionAttachment } from '@/app/Library/Context/SelectionAttachmentContext';
import { useSearchContext } from '@/app/Library/Context/SearchContext';
import type { ResourceType } from '@/app/studygraph/(studygraph)/components/layout/CardDisplay/v2/AddResourceDropdown.tsx';
import type { ResourceFormInput } from '../../../CardDisplay/types/resourceForm';
import { useAccessEditSnapshot } from '@/app/Library/Context/AccessLayer/selectors';
import '@/app/studygraph/(studygraph)/components/layout/CardDisplay/v2/CardDisplay.css'; // Existing styling overrides for panel, header, footer

type Mode = 'note' | 'edit' | 'chat';

export interface CardDisplayProps {
  mode: Mode;
  setMode: (tab: Mode) => void;
  askHandler: () => void;
}

const CardDisplay: React.FC<CardDisplayProps> = ({ mode, setMode, askHandler }) => {
  /**
   * @function CardDisplay (component body)
   * @description
   * Coordinates header, tabs, and footer for the resource panel. This function computes `canEdit`
   * from DAM and threads it to children to gate write-only behaviors. It owns resource creation/
   * editing initiation and save/cancel handoff to `EditTab` via a ref. It also tracks form validity
   * signaled from `ResourceDisplay` so that the Save button is only enabled when inputs are valid
   * and editing is permitted. Handlers are O(1) with early returns; rendering preserves CSS hooks.
   */
  // 0) Capability gating — single source of truth (DAM)                                 
  const { status, editReady} = useAccessEditSnapshot();                   
  const canEdit =  editReady 

  // 1) Editing state and EditTab ref
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const editTabRef = useRef<EditTabRef>(null);

  // 2) Centralized form input buffer for create/edit
  const [inputData, setInputData] = useState<ResourceFormInput>({
    selectedTopicId: '',
    createNode: false,
    nodeTitle: '',
    file: undefined,
  });

  // 3) Resource form validity surfaced from ResourceDisplay
  const [isFormValid, setIsFormValid] = useState(false);

  // 4) Ask/Search/Quiz toggles that can affect visible tab
  const { isAskOpen, isExploreOpen, isQuizOpen } = useSelectionAttachment();
  const { selectedResultIds } = useSearchContext();

  useEffect(() => {
    if (isAskOpen) setMode('chat');
    else if (isExploreOpen || isQuizOpen) setMode('note');
  }, [isAskOpen, isExploreOpen, isQuizOpen, setMode]);

  useEffect(() => {
    if (selectedResultIds.length > 0) setMode('note');
  }, [selectedResultIds, setMode]);

  // 5) Mutating handlers (guarded by canEdit)
  const handleAddResource = (type: ResourceType) => {
    if (!canEdit) {
      console.log('[CardDisplay.tsx][5202] blocked addResource — not edit-ready', { type });
      return;
    }
    // Reset form inputs before creating a new draft
    setInputData({ selectedTopicId: '', createNode: false, nodeTitle: '', file: undefined });
    editTabRef.current?.createDraft(type);
    setMode('edit');
  };

  const handleEditExisting = (id: string) => {
    if (!canEdit) {
      console.log('[CardDisplay.tsx][5203] blocked editExisting — not edit-ready', { id }); 
      return;
    }
    setInputData({ selectedTopicId: '', createNode: false, nodeTitle: '', file: undefined });
    editTabRef.current?.startEdit(id);
    setEditingResourceId(id);
    setMode('edit');
  };

  const handleSave = async () => {
    if (!canEdit) {
      console.log('[CardDisplay.tsx][5204] blocked save — not edit-ready'); 
      return;
    }
    if (!isFormValid) {
      console.log('[CardDisplay.tsx][5205] blocked save — form invalid'); 
      return;
    }
    await editTabRef.current?.save();
    setEditingResourceId(null);
    setMode('note');
    console.log('[CardDisplay.tsx][5206] save completed'); 
  };

  const handleCancel = () => {
    if (!canEdit) {
      console.log('[CardDisplay.tsx][5207] blocked cancel — not edit-ready'); 
      return;
    }
    editTabRef.current?.cancel();
    setEditingResourceId(null);
    setMode('note');
    console.log('[CardDisplay.tsx][5208] edit canceled'); 
  };

  // 6) Tab switch guard — if an edit is active, cancel it first (only when editing is allowed)
  const handleTabChange = (tab: 'notes' | 'chat') => {
    if (editingResourceId && canEdit) {
      editTabRef.current?.cancel();
      setEditingResourceId(null);
      console.log('[CardDisplay.tsx][5209] edit canceled due to tab switch');
    }
    setMode(tab === 'chat' ? 'chat' : 'note');
  };

  return (
    <div className="panel panel--md theme-scope" data-theme="warm-board">
      {/* Header: unified tokenized rail surface (DOM/CSS preserved) */}
      <UnifiedHeader                                                                  
        activeTab={mode === 'chat' ? 'chat' : 'notes'}
        onTabChange={handleTabChange}
        width={380}
        onTopicChange={() => {
          handleAddResource('note');                                                       
        }}
      />

      {/* Content body (absolute inset wrapper preserved) */}
      <div className="flex-1 min-h-0 relative">
        <div className={`card-body absolute inset-0 ${mode !== 'chat' ? 'has-footer' : ''}`}>
          {mode === 'chat' && <ChatTab />}

          {mode === 'note' && (
            <NotesTab
              /* NotesTab mutators are gated internally; we still pass canEdit for UI affordances */  
              canEdit={canEdit}                                                                      
              onAddResource={handleAddResource}
              onEditResource={handleEditExisting}
            />
          )}

          {/* EditTab remains mounted so validation piping continues to update Save state */}
          <EditTab
            ref={editTabRef}
            editingResourceId={editingResourceId}
            setEditingResourceId={setEditingResourceId}
            width={380}
            inputData={inputData}
            onInputDataChange={setInputData}
            onValidate={setIsFormValid}
            canEdit={canEdit} 
          />
        </div>
      </div>

      {/* Footer: Save/Cancel cluster is visible & enabled only when both editing and canEdit. */}
      {mode !== 'chat' && (
        <ActionFooter
          /* Gate all edit controls centrally via canEdit; Ask stays available in RO */                                                                  
          editing={mode === 'edit'}
          onAddResource={handleAddResource}
          onSave={handleSave}
          onCancel={handleCancel}
          isSaveDisabled={!canEdit || !isFormValid}                                         
          askHandler={askHandler}
          canEdit={canEdit}
        />
      )}
    </div>
  );
};

export default CardDisplay;
