// src/app/studygraph/(studygraph)/components/layout/ResourceDisplay.tsx

import React, { useState, useRef, useEffect } from 'react';
import BaseResourceCard from './Cards/BaseResourceCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Maximize2, ChevronsUpDown, Check } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';
import ResourceMenu from './ResourceMenu';
import CueCard from './Cards/CueCard';
import NoteCard from './Cards/NoteCard';
import ImageCard from './Cards/ImageCard';
import QuizCard from './Cards/QuizCard';
import ImageUploadCard from './Cards/ImageUploadCard';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';
import './resourceDisplay.css';

export type ResourceType = 'cuecard' | 'note' | 'image' | 'quiz';

export interface ResourceDisplayProps {
  id: string;
  type: ResourceType;
  ConceptNodeTitle: string;
  title: string;
  content: string | object;
  isEditing: boolean;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onCancel: () => void;
  onSave: (data?: { file?: File; selectedTopicId?: string }) => void;
  onEdit: () => void;
  onDelete: () => void;
  onAskAI: () => void;
  onImageCaption: () => void;
  imageUrl?: string;
}

/**
 * @file ResourceDisplay.tsx
 * @description
 *   Renders a single resource card with both view and edit modes.
 *
 *   View mode:
 *   - Displays the appropriate card type (CueCard, NoteCard, ImageCard, QuizCard).
 *   - Provides fullscreen and overflow menu controls.
 *   - Shows the ConceptNodeTitle in a full-width, fully opaque footer strip.
 *
 *   Edit mode:
 *   - Lets the user select a topic, edit the title, and edit/upload content.
 *   - Exposes Save and Cancel actions.
 *
 *   Responsibilities:
 *   - Ensure the footer always provides a fully opaque background
 *     across the bottom of the card for maximum title readability,
 *     regardless of title length.
 *   - Handle topic selection dropdown with outside-click closing.
 *   - Integrate global SlideShowContext for fullscreen display.
 *   - Parse quiz JSON only when needed.
 */
const ResourceDisplay: React.FC<ResourceDisplayProps> = ({
  id,
  type,
  ConceptNodeTitle,
  title,
  content,
  isEditing,
  onTitleChange,
  onContentChange,
  onCancel,
  onSave,
  onEdit,
  onDelete,
  onAskAI,
  onImageCaption,
  imageUrl,
}) => {
  const { open } = useSlideShow();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [topicId, setTopicId] = useState('');
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { nodes } = useNodesContext();
  const nodeArray = Array.from(nodes.values());
  const { getFocusNode } = useNodeSelection();
  const topicSelectorRef = useRef<HTMLDivElement>(null);
  const [cueFlipped, setCueFlipped] = useState(false);

  // Close topic dropdown when clicking outside
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

  // Auto-select current focus node when entering edit mode
  useEffect(() => {
    if (!topicId && isEditing) {
      const auto = getFocusNode();
      if (auto) setTopicId(auto);
    }
  }, [isEditing, topicId, getFocusNode]);

  const handleSave = () => {
    onSave({ file: selectedFile ?? undefined, selectedTopicId: topicId });
    setSelectedFile(null);
  };

  const commonViewProps = { ConceptNodeTitle, title };

  const renderBody = () => {
    if (isEditing) {
      return (
        <>
          {/* Topic selector */}
          <div className="mb-6" ref={topicSelectorRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Topic
            </label>
            <div className="relative">
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 border rounded-md"
                onClick={() => setIsTopicDropdownOpen(o => !o)}
              >
                {topicId
                  ? nodeArray.find(n => n.id === topicId)?.title
                  : 'Select topic...'}
                <ChevronsUpDown className="ml-2 h-4 w-4" />
              </button>
              {isTopicDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 border rounded-md bg-white shadow-lg">
                  <input
                    type="text"
                    placeholder="Search topics..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border-b"
                  />
                  <div className="max-h-60 overflow-auto">
                    {nodeArray
                      .filter(n =>
                        n.title.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map(node => (
                        <div
                          key={node.id}
                          className={`px-3 py-2 flex items-center cursor-pointer hover:bg-gray-100 ${
                            node.id === topicId ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => {
                            setTopicId(node.id);
                            setIsTopicDropdownOpen(false);
                            setSearchQuery('');
                          }}
                        >
                          {node.id === topicId && (
                            <Check className="mr-2 h-4 w-4 text-blue-600" />
                          )}
                          {node.title}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Title input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <Input
              value={title}
              onChange={e => onTitleChange(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Content or image upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content
            </label>
            {type === 'image' ? (
              <ImageUploadCard
                content={typeof content === 'string' ? content : ''}
                onContentChange={onContentChange}
                onImageSelect={file => setSelectedFile(file)}
                previewUrl={
                  selectedFile ? URL.createObjectURL(selectedFile) : imageUrl
                }
              />
            ) : (
              <RichTextEditor
                content={typeof content === 'string' ? content : ''}
                onChange={onContentChange}
                className="min-h-[200px]"
              />
            )}
          </div>

          {/* Edit controls */}
          <div className="flex justify-end space-x-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        </>
      );
    }

    // View mode: pick the right card
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
        let quizData: any;
        if (typeof content === 'string') {
          try {
            quizData = JSON.parse(content);
          } catch {
            console.warn(
              'ResourceDisplay: quiz content is not valid JSON, passing raw:',
              content
            );
            quizData = content;
          }
        } else {
          quizData = content;
        }
        return <QuizCard {...commonViewProps} content={quizData} />;
      }
      default:
        return (
          <div
            onClick={() => setCueFlipped(f => !f)}
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

  return (
    <BaseResourceCard className="!p-0 flex flex-col max-h-[24rem] relative">
      {/* Top‐right controls in view mode */}
      {!isEditing && (
        <div className="absolute top-2 right-2 flex items-center space-x-1">
          <button
            onClick={() => open(id)}
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-gray-100"
            title="Full screen"
          >
            <Maximize2 className="h-3 w-3 text-gray-500" />
          </button>
          <ResourceMenu
            onEdit={onEdit}
            onDelete={onDelete}
            onAskAI={onAskAI}
            onImageCaption={onImageCaption}
            resourceType={type}
          />
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto resource-body pb-24">
        <div className="px-6 pt-10">{renderBody()}</div>
      </div>

      {/* Full-width opaque footer for the concept node title */}
      {!isEditing && (
        <footer className="absolute bottom-0 left-0 w-full bg-[#F8FBFE] px-4 py-2 text-text-meta text-xs font-medium z-10">
          {ConceptNodeTitle}
        </footer>
      )}
    </BaseResourceCard>
  );
};

export default ResourceDisplay;
