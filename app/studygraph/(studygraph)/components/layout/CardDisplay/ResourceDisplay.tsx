// ResourceDisplay.tsx

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
import ContentOverlay from '../../utils/ContentOverlay';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import './resourceDisplay.css';

export type ResourceType = 'cuecard' | 'note' | 'image' | 'quiz';

export interface ResourceDisplayProps {
  id: string;
  type: ResourceType;
  topicTitle: string;
  title: string;
  content: string;
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
 *   Renders a resource card with:
 *     - Padded scrollable body for edit and all types except cuecard view
 *     - Full-area flip handler for cuecards (state lifted here)
 *     - Controls top-right (fullscreen/menu) and footer bottom-left
 */
const ResourceDisplay: React.FC<ResourceDisplayProps> = ({
  id, type, topicTitle, title, content, isEditing,
  onTitleChange, onContentChange, onCancel, onSave,
  onEdit, onDelete, onAskAI, onImageCaption, imageUrl,
}) => {
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [topicId, setTopicId] = useState('');
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { nodes } = useNodesContext();
  const nodeArray = Array.from(nodes.values());
  const { getFocusNode } = useNodeSelection();
  const topicSelectorRef = useRef<HTMLDivElement>(null);

  // Lifted flip state for cuecard
  const [cueFlipped, setCueFlipped] = useState(false);

  // Close topic dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (topicSelectorRef.current && !topicSelectorRef.current.contains(e.target as Node)) {
        setIsTopicDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-select topic when entering edit mode
  useEffect(() => {
    if (!topicId && isEditing) {
      const auto = getFocusNode();
      if (auto) setTopicId(auto);
    }
  }, [isEditing, topicId, getFocusNode]);

  // Save handler
  const handleSave = () => {
    onSave({ file: selectedFile ?? undefined, selectedTopicId: topicId });
    setSelectedFile(null);
  };

  // Shared view props
  const commonViewProps = { topicTitle, title };

  // Render body for edit & other types
  const renderBody = () => {
    if (isEditing) {
      return (
        <>
          {/* Topic selector */}
          <div className="mb-6" ref={topicSelectorRef}>
            <label htmlFor={`topic-${id}`} className="block text-sm font-medium text-gray-700 mb-1">
              Select Topic
            </label>
            <div className="relative">
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 border rounded-md"
                onClick={() => setIsTopicDropdownOpen(o => !o)}
              >
                {topicId ? nodeArray.find(n => n.id === topicId)?.title : 'Select topic...'}
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
                      .filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(node => (
                        <div
                          key={node.id}
                          className={`px-3 py-2 cursor-pointer hover:bg-gray-100 flex items-center ${
                            node.id === topicId ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => {
                            setTopicId(node.id);
                            setIsTopicDropdownOpen(false);
                            setSearchQuery('');
                          }}
                        >
                          {node.id === topicId && <Check className="mr-2 h-4 w-4 text-blue-600" />}
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
            <label htmlFor={`title-${id}`} className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <Input
              id={`title-${id}`}
              placeholder="Enter title"
              value={title}
              onChange={e => onTitleChange(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Content / Image upload */}
          <div className="mb-6">
            <label htmlFor={`content-${id}`} className="block text-sm font-medium text-gray-700 mb-1">
              Content
            </label>
            {type === 'image' ? (
              <ImageUploadCard
                content={content}
                onContentChange={onContentChange}
                onImageSelect={file => setSelectedFile(file)}
                previewUrl={selectedFile ? URL.createObjectURL(selectedFile) : imageUrl}
              />
            ) : (
              <RichTextEditor
                content={content}
                onChange={onContentChange}
                className="min-h-[200px]"
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>Save</Button>
          </div>
        </>
      );
    }

    // Non-edit & non-cuecard types
    switch (type) {
      case 'note':
        return <NoteCard {...commonViewProps} content={content} />;
      case 'image':
        return <ImageCard {...commonViewProps} content={content} imageUrl={imageUrl || ''} />;
      case 'quiz': {
        const quizData = typeof content === 'string' ? JSON.parse(content) : content;
        return <QuizCard {...commonViewProps} content={quizData} />;
      }
      default:
        return null;
    }
  };

  return (
    <>
      <BaseResourceCard className="!p-0 flex flex-col max-h-[24rem] relative">
        {/* Top-right controls */}
        {!isEditing && (
          <div className="absolute top-2 right-2 flex items-center space-x-1">
            <button
              onClick={() => setIsOverlayOpen(true)}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto resource-body pb-24"
        onClick={() => setCueFlipped(f => !f)}
        title="Click to flip the card">

          <div className="px-6 pt-10">
            { !isEditing && type === 'cuecard' ? (
              <div
                className="relative h-full w-full cursor-pointer"
    
              >
                <CueCard title={title} content={content} flipped={cueFlipped} />
              </div>
            ) : (
              renderBody()
            )}
          </div>
        </div>

        {/* Footer */}
        {!isEditing && (
          <p className="absolute bottom-2 left-2 bg-[#F8FBFE] px-2 py-1 text-text-meta text-xs font-medium z-10">
            {topicTitle}
          </p>
        )}
      </BaseResourceCard>

      {/* Full-screen overlay */}
      {isOverlayOpen && (
        <ContentOverlay
          isOpen={isOverlayOpen}
          onClose={() => setIsOverlayOpen(false)}
          title={title}
          type={type === 'image' ? 'image' : 'note'}
          content={content}
          imageUrl={imageUrl}
        />
      )}
    </>
  );
};

export default ResourceDisplay;
