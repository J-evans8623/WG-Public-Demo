/**
 * @file CardDisplay.tsx
 * @description
 *   Top‐level right‐hand pane: renders UnifiedHeader, NotesTab/ChatTab/EditTab, and ActionFooter.
 *   This update wires up ResourceDisplay’s validation state so that:
 *     • We maintain a local `isFormValid` flag in CardDisplay.
 *     • Pass `onValidate={setIsFormValid}` into ResourceDisplay so it notifies us when the form is valid.
 *     • Modify the external “Save” button in ActionFooter to be disabled unless `isFormValid === true`.
 *     • When the “Save” button is clicked, we only call `handleSave()` (EditTab.save) if the form is valid.
 *   All other behavior and styling remain unchanged.
 */

import React, { useState, useRef, useEffect } from 'react';
import NotesTab from './NotesTab';
import ChatTab from './ChatTab';
import EditTab, { EditTabRef } from './EditTab';
import UnifiedHeader from './UnifiedHeader';
import ActionFooter from './ActionFooter';
import { useSelectionAttachment } from '@/app/Library/Context/SelectionAttachmentContext';
import { useSearchContext } from '@/app/Library/Context/SearchContext';
import type { ResourceType } from './AddResourceDropdown';
import type { ResourceFormInput } from '../types/resourceForm';
import './CardDisplay.css'; // Existing styling overrides for panel, header, footer

export interface CardDisplayProps {}

type Mode = 'read' | 'edit' | 'chat';

const CardDisplay: React.FC<CardDisplayProps> = () => {
  // 1) Which panel are we in?
  const [mode, setMode] = useState<Mode>('read');
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const editTabRef = useRef<EditTabRef>(null);

  // 2) Centralized form‐input state for resource creation/editing
  const [inputData, setInputData] = useState<ResourceFormInput>({
    selectedTopicId: '',
    createNode: false,
    nodeTitle: '',
    file: undefined,
  });

  // New: Track whether ResourceDisplay’s form is currently valid
  const [isFormValid, setIsFormValid] = useState(false);

  // 3) PDF‐ask / search‐explore toggling
  const { isAskOpen, isExploreOpen, isQuizOpen } = useSelectionAttachment();
  const { selectedResultIds } = useSearchContext();
  useEffect(() => {
    if (isAskOpen) setMode('chat');
    else if (isExploreOpen || isQuizOpen) setMode('read');
  }, [isAskOpen, isExploreOpen, isQuizOpen]);
  useEffect(() => {
    if (selectedResultIds) setMode('read');
  }, [selectedResultIds]);

  // 4) Handlers for NotesTab “add” and “edit”
  const handleAddResource = (type: ResourceType) => {
    // Reset all form inputs before creating a new draft
    setInputData({ selectedTopicId: '', createNode: false, nodeTitle: '', file: undefined });
    editTabRef.current?.createDraft(type);
    setMode('edit');
  };
  const handleEditExisting = (id: string) => {
    // Clear form flags when editing existing
    setInputData({ selectedTopicId: '', createNode: false, nodeTitle: '', file: undefined });
    editTabRef.current?.startEdit(id);
    setMode('edit');
  };

  // 5) Footer Save / Cancel
  const handleSave = async () => {
    await editTabRef.current?.save();
    setEditingResourceId(null);
    setMode('read');
  };
  const handleCancel = () => {
    editTabRef.current?.cancel();
    setEditingResourceId(null);
    setMode('read');
  };

  // 6) Tab switching must clean up any in‐progress edit
  const handleTabChange = (tab: 'notes' | 'chat') => {
    // If a draft/edit is active, cancel it immediately
    if (editingResourceId) {
      editTabRef.current?.cancel();
      setEditingResourceId(null);
    }
    setMode(tab === 'chat' ? 'chat' : 'read');
  };

  return (
    <div
      className="panel"
      style={{ '--card-display-width': `380px` } as React.CSSProperties}
    >
      {/* UnifiedHeader still manages “Notes / Chat” toggling */}
      <UnifiedHeader
        activeTab={mode === 'chat' ? 'chat' : 'notes'}
        onTabChange={handleTabChange}
        width={380}
        onTopicChange={() => {
          // If the user clicks the topic itself, trigger a new “note” draft
          editTabRef.current?.createDraft('note');
          setMode('edit');
        }}
      />

      {/*
        Restore the original “absolute inset-0” content wrapper, with conditional bottom padding.
        When mode === 'chat', we omit pb-16 to prevent extra blank space under chat.
      */}
      <div className="flex-1 min-h-0 relative">
        <div className={`absolute inset-0 ${mode !== 'chat' ? 'pb-16' : ''}`}>
          {mode === 'chat' && <ChatTab />}

          {mode === 'read' && (
            <NotesTab
              onAddResource={handleAddResource}
              onEditResource={handleEditExisting}
            />
          )}

          <EditTab
            ref={editTabRef}
            editingResourceId={editingResourceId}
            setEditingResourceId={setEditingResourceId}
            width={380}
            inputData={inputData}
            onInputDataChange={setInputData}
            // New: forward the validation callback so ResourceDisplay can notify us
            onValidate={setIsFormValid}
          />
        </div>
      </div>

      {mode !== 'chat' && (
        <ActionFooter
          editing={mode === 'edit'}
          onAddResource={handleAddResource}
          onSave={() => {
            // Only actually save if ResourceDisplay has validated the form
            if (isFormValid) {
              handleSave();
            }
            // If invalid, ResourceDisplay’s inline errors are already shown.
          }}
          onCancel={handleCancel}
          isSaveDisabled={!isFormValid}
        />
      )}
    </div>
  );
};

export default CardDisplay;
