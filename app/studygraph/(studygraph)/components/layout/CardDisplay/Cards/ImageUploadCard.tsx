/**
 * @file ImageUploadCard.tsx
 * @description
 *   A specialized card for uploading and previewing an image resource in edit mode.
 *   Supports drag-and-drop, clipboard paste, click-to-upload, and an inline RichTextEditor
 *   for describing the image.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Image as ImageIcon } from 'lucide-react';
import RichTextEditor from '@/components/RichTextEditor';

export interface ImageUploadCardProps {
  content: string;
  onContentChange: (content: string) => void;
  /** Fires when the user selects/drops an image file */
  onImageSelect: (file: File) => void;
  previewUrl?: string;
}

const ImageUploadCard: React.FC<ImageUploadCardProps> = ({
  content,
  onContentChange,
  onImageSelect,
  previewUrl,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Listen for paste events
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image')) {
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

  // Drag-and-drop handlers
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
    if (file?.type.startsWith('image/')) {
      onImageSelect(file);
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative aspect-video rounded-lg border-2 border-dashed
          transition-colors
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
        `}
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
              Drag & drop an image, paste from clipboard, or upload
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImageSelect(file);
              }}
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

      {/* Rich Text Editor for caption/description */}
      <div className="border rounded-lg [&_.ProseMirror]:min-h-[100px] [&_.ProseMirror]:p-4">
        <RichTextEditor content={content} onChange={onContentChange} />
      </div>
    </div>
  );
};

export default ImageUploadCard;
