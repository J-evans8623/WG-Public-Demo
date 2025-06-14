// src/app/studygraph/(studygraph)/components/layout/CardDisplay/CardDisplay.tsx

/**
 * @file CardDisplay.tsx
 * @description
 *   Top‐level right‐hand pane:
 *   • Renders UnifiedHeader, NotesTab/ChatTab/EditTab.
 *   • Owns the “Save” button in ActionFooter.
 *   • **Phase 1**: now contains the single source of truth
 *     for all resource‐form inputs (selectedTopicId, createNode, nodeTitle, file).
 */

import React, { useState, useRef, useEffect } from 'react';
import NotesTab from './NotesTab';
import ChatTab from './chatTab/ChatTab';
import EditTab, { EditTabRef } from './EditTab';
import UnifiedHeader from './UnifiedHeader';
import ActionFooter from './Cards/ActionFooter';
import { useSelectionAttachment } from '@/app/Library/Context/SelectionAttachmentContext';
import { useSearchContext } from '@/app/Library/Context/SearchContext';
import type { ResourceType } from './buttons/AddResourceDropdown';
import type { ResourceFormInput } from './types/resourceForm';

export interface CardDisplayProps {
  currentTopicTitle: string;
}

type Mode = 'read' | 'edit' | 'chat';

const CardDisplay: React.FC<CardDisplayProps> = ({ currentTopicTitle }) => {
  // 1) Which panel are we in?
  const [mode, setMode] = useState<Mode>('read');
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const editTabRef = useRef<EditTabRef>(null);
  const width = 325;

  // 2) Centralized form‐input state for resource creation/editing
  const [inputData, setInputData] = useState<ResourceFormInput>({
    selectedTopicId: '',
    createNode: false,
    nodeTitle: '',
    file: undefined,
  });

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

  // 5) Footer Save/Cancel
  const handleSave = async () => {
    // Will receive `inputData` in the upcoming phase when EditTab.merge & ResourceDisplay uses it
    await editTabRef.current?.save();
    setEditingResourceId(null);
    setMode('read');
  };
  const handleCancel = () => {
    editTabRef.current?.cancel();
    setEditingResourceId(null);
    setMode('read');
  };

  return (
    <div className="relative h-full" style={{ width: `${width / 16}rem` }}>
      <div className="flex flex-col h-full map-right-pane map-border border-l map-divider">
        <UnifiedHeader
          activeTab={mode === 'chat' ? 'chat' : 'notes'}
          onTabChange={(t) => setMode(t === 'chat' ? 'chat' : 'read')}
          width={width}
          selectedTopic={currentTopicTitle}
          onTopicChange={() => setMode('edit')}
        />

        <div className="flex-1 min-h-0 relative">
          <div className="absolute inset-0 pb-16">
            {mode === 'chat' && <ChatTab />}
            {mode === 'read' && (
              <NotesTab
                currentTopicTitle={currentTopicTitle}
                onAddResource={handleAddResource}
                onEditResource={handleEditExisting}
              />
            )}
            <EditTab
              ref={editTabRef}
              editingResourceId={editingResourceId}
              setEditingResourceId={setEditingResourceId}
              currentTopicTitle={currentTopicTitle}
              width={width}
              // **Phase 1**: pass down our centralized inputData + updater
              inputData={inputData}
              onInputDataChange={setInputData}
            />
          </div>
        </div>

        {mode !== 'chat' && (
          <ActionFooter
            editing={mode === 'edit'}
            onAddResource={handleAddResource}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        )}
      </div>
    </div>
  );
};

export default CardDisplay;
