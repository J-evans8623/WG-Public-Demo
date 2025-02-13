import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Maximize2, Upload, Image as ImageIcon } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';
import ResourceMenu from './ResourceMenu';
import CueCard from './Cards/CueCard';
import NoteCard from './Cards/NoteCard';
import ImageCard from './Cards/ImageCard';
import QuizCard from './Cards/QuizCard';
import ContentOverlay from '../../utils/ContentOverlay';

export type ResourceType = 'cuecard' | 'note' | 'image' | 'quiz';

interface ImageUploadCardProps {
  content: string;
  onContentChange: (content: string) => void;
  onImageSelect: (file: File) => void;
  previewUrl?: string;
}

const ImageUploadCard: React.FC<ImageUploadCardProps> = ({
  content,
  onContentChange,
  onImageSelect,
  previewUrl
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            onImageSelect(file);
            e.preventDefault();
            break;
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [onImageSelect]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      onImageSelect(file);
    }
  };

  return (
    <div className="space-y-4">
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative aspect-video rounded-lg border-2 border-dashed transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }`}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full h-full object-contain rounded-lg"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <ImageIcon className="w-12 h-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">
              Drag and drop an image here, or paste from clipboard
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImageSelect(file);
              }}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Image
            </Button>
          </div>
        )}
      </div>

      <div className="[&_.ProseMirror]:min-h-[100px] [&_.ProseMirror]:p-4 [&_.ProseMirror]:outline-none border rounded-lg">
        <RichTextEditor
          content={content}
          onChange={onContentChange}
          className="w-full"
        />
      </div>
    </div>
  );
};

export interface ResourceDisplayProps {
  id: string;
  type: ResourceType;
  topicTitle: string;
  title: string;
  content: string;
  isEditing: boolean;
  typeColors: { [key in ResourceType]: string };
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onCancel: () => void;
  onSave: (data?: { file?: File }) => void;
  onEdit: () => void;
  onDelete: () => void;
  onAskAI: () => void;
  onImageCaption: () => void;
  imageUrl?: string;
}

const ResourceDisplay: React.FC<ResourceDisplayProps> = ({
  id,
  type,
  topicTitle,
  title,
  content,
  isEditing,
  typeColors,
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
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const renderCardContent = () => {
    const commonProps = {
      topicTitle,
      title,
    };

    switch (type) {
      case 'cuecard':
        return <CueCard {...commonProps} content={content} />;
      case 'note':
        return <NoteCard {...commonProps} content={content} />;
      case 'image':
        return <ImageCard {...commonProps} content={content} imageUrl={imageUrl || ''} />;
      case 'quiz':
        const quizContent = typeof content === 'string' ? JSON.parse(content) : content;
        return <QuizCard {...commonProps} content={quizContent} />;
      default:
        return null;
    }
  };

  const handleSave = () => {
    onSave({ file: selectedFile || undefined });
    setSelectedFile(null);
  };

  return (
    <div className="relative">
      <Card className={`relative border shadow-sm hover:shadow-md transition-all ${typeColors[type]}`}>
        <div className="absolute right-4 top-4 flex items-center">
          <button
            onClick={() => setIsOverlayOpen(true)}
            className="hover:bg-gray-100 h-8 w-8 p-0 flex items-center justify-center rounded-full"
            title="Open in full screen"
          >
            <Maximize2 className="h-[0.75rem] w-[0.75rem] text-gray-500" />
          </button>
          {!isEditing && (
            <ResourceMenu
              onEdit={onEdit}
              onDelete={onDelete}
              onAskAI={onAskAI}
              onImageCaption={onImageCaption}
              resourceType={type}
            />
          )}
        </div>

        <div className="p-4">
          {isEditing ? (
            <div className="space-y-4">
              <div className="mb-4">
                <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                  {topicTitle}
                </span>
                <div className="mt-1 h-px bg-gray-200" />
              </div>
              <div className="mb-6">
                <label htmlFor={`title-${id}`} className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <Input
                  id={`title-${id}`}
                  placeholder="Enter title"
                  value={title}
                  onChange={(e) => onTitleChange(e.target.value)}
                  className="w-full border-gray-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-base leading-relaxed"
                />
              </div>
              <div className="mb-6">
                <label htmlFor={`content-${id}`} className="block text-sm font-medium text-gray-700 mb-1">
                  Content
                </label>
                {type === 'image' ? (
                  <ImageUploadCard
                    content={content}
                    onContentChange={onContentChange}
                    onImageSelect={(file) => setSelectedFile(file)}
                    previewUrl={selectedFile ? URL.createObjectURL(selectedFile) : imageUrl}
                  />
                ) : (
                  <div className="[&_.ProseMirror]:outline-none [&_.ProseMirror-focused]:outline-none [&_.tiptap]:outline-none min-h-[200px]">
                    <RichTextEditor
                      content={content}
                      onChange={onContentChange}
                      className="w-full min-h-[200px] p-4"
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} className="bg-sky-600 hover:bg-sky-700 text-white">
                  Save
                </Button>
              </div>
            </div>
          ) : (
            renderCardContent()
          )}
        </div>
      </Card>

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
    </div>
  );
};

export default ResourceDisplay;