import React from 'react';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import SafeContent from '../../../utils/SafeContent';

export interface ImageCardProps {
  topicTitle: string;
  title: string;
  imageUrl: string;
  content?: string;
}

const ImageCard: React.FC<ImageCardProps> = ({ topicTitle, title, imageUrl, content }) => {
  return (
    <div className="py-[1.125rem]">
      {/* Header Section */}
      <div className="flex flex-col">
        <div className="flex items-center">
          <div className="flex items-center gap-3">
            <Badge
              variant="secondary"
              className="bg-indigo-100 text-indigo-700 border-indigo-200"
            >
              Image
            </Badge>
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              {topicTitle}
            </span>
          </div>
        </div>
        <div className="mt-1 h-px bg-gray-200" />
      </div>

      {/* Title */}
      <h3 className="font-medium text-xl mt-6 text-gray-900 leading-relaxed">
        {title}
      </h3>

      {/* Image and Description */}
      <div className="mt-6">
        <div className="aspect-video bg-gray-50 rounded-lg relative overflow-hidden">
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-contain"
          />
        </div>
        {content && (
          <div className="mt-4 p-6 border-t">
            <SafeContent
              html={content}
              className="prose text-gray-700 text-base leading-relaxed tracking-normal"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageCard;
