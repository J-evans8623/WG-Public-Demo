/***************************************************************************************
 * @file CardDisplay.tsx   – shadow-divider variant
 * @description
 *   Removes the hard border altogether and instead casts a subtle left-side shadow
 *   so the notes/chat pane feels elevated next to the map canvas.
 ***************************************************************************************/

import React, { useState, useRef } from 'react';
import { ResizeHandle } from '../shared/ResizeHandle';
import NotesTab from './NotesTab';
import ChatTab from './chatTab/ChatTab';
import UnifiedHeader from './UnifiedHeader';
import { ResourceType } from './buttons/AddResourceDropdown';

export interface CardDisplayProps {
  width: number;
  isEditMode: boolean;
  currentTopicTitle: string;
  onEditToggle: () => void;
  onResize: (width: number) => void;
}

interface NotesTabRef {
  handleAddResource: (type: ResourceType) => void;
}

export const CardDisplay: React.FC<CardDisplayProps> = ({
  width,
  isEditMode,
  currentTopicTitle,
  onResize,
}) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'chat'>('notes');
  const [selectedTopic, setSelectedTopic] = useState('');
  const notesTabRef = useRef<NotesTabRef>(null);

  return (
    <div className="relative h-full" style={{ width: `${width / 16}rem` }}>
      <div
        className="
          flex flex-col h-full
          bg-[var(--right-pane-bg)] text-[var(--right-pane-text)]
          /* ↓ subtle inset shadow instead of border */
          shadow-[-4px_0_6px_-4px_rgba(0,0,0,0.06)]
        "
      >
        <UnifiedHeader
          activeTab={activeTab}
          onTabChange={setActiveTab}
          width={width}
          selectedTopic={selectedTopic}
          onTopicChange={setSelectedTopic}
        />

        <div className="flex-1 min-h-0 relative">
          <div className="absolute inset-0 overflow-y-auto">
            {activeTab === 'notes' ? (
              <NotesTab
                ref={notesTabRef}
                currentTopicTitle={currentTopicTitle}
                isEditMode={isEditMode}
                onSwitchToChat={() => setActiveTab('chat')}
                width={width}
              />
            ) : (
              <ChatTab />
            )}
          </div>
        </div>
      </div>

      {/* resize handle still present; now floats over the shadow */}
      <ResizeHandle placement="left" onDrag={onResize} />
    </div>
  );
};

export default CardDisplay;
