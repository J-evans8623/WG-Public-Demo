import React from 'react';
import { X } from 'lucide-react';
import Image from 'next/image';
import SafeContent from './SafeContent';

interface ContentOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'note' | 'image';
  content: string;
  imageUrl?: string;
}

const ContentOverlay: React.FC<ContentOverlayProps> = ({
  isOpen,
  onClose,
  title,
  type,
  content,
  imageUrl
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      <div 
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] bg-white rounded-lg shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {type === 'image' ? (
            <div className="flex flex-col h-full">
              <div className="relative h-96 w-full bg-gray-100">
                {imageUrl && (
                  <Image
                    src={imageUrl}
                    alt={title}
                    fill
                    className="object-contain"
                  />
                )}
              </div>
              <div className="p-6 border-t">
                <SafeContent
                  html={content}
                  className="prose text-gray-700 text-base leading-relaxed tracking-normal"
                />
              </div>
            </div>
          ) : (
            <div className="p-6">
              <SafeContent
                html={content}
                className="prose max-w-none text-gray-700 text-base leading-relaxed tracking-normal"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContentOverlay;