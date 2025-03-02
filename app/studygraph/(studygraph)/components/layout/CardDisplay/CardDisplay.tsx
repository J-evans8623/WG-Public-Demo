import React, { useState, useRef } from 'react';
import { ResizeHandle } from '../shared/ResizeHandle';
import NotesTab from './NotesTab';
import ChatTab from './chatTab/ChatTab';
import UnifiedHeader from './UnifiedHeader';
import { ResourceType } from './buttons/AddResourceDropdown';
import '@/app/studygraph/(studygraph)/components/layout/mapTheme.css';

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
  onEditToggle,
  onResize,
}) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'chat'>('notes');
  const [selectedTopic, setSelectedTopic] = useState('');
  const notesTabRef = useRef<NotesTabRef>(null);

  const handleAddResource = (type: ResourceType) => {
    if (notesTabRef.current) {
      notesTabRef.current.handleAddResource(type);
    }
  };

  return (
    <div className="relative h-full" style={{ width: `${width / 16}rem` }}>
      <div
        className="
          flex
          flex-col
          h-full
          map-right-pane
          map-border
          /* If you want a left divider from the Canvas: */
          border-l map-divider
        "
      >
        <UnifiedHeader
          activeTab={activeTab}
          onTabChange={setActiveTab}
          width={width}
          onAddResource={handleAddResource}
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
      <ResizeHandle placement="left" onDrag={onResize} />
    </div>
  );
};

export default CardDisplay;
