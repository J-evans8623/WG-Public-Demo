/**
 * @file ImageCard.tsx
 * @description
 *   Image card body (no footer).  Title + image + optional caption.
 */

import React from 'react';
import Image from 'next/image';
import SafeContent from '../../../utils/SafeContent';

export interface ImageCardProps {
  title: string;
  imageUrl: string;
  content?: string;
}

const ImageCard: React.FC<ImageCardProps> = ({
  title,
  imageUrl,
  content,
}) => (
  <div>
    <h3 className="text-text-title text-xl font-bold text-center mb-4">
      {title}
    </h3>
    <div className="aspect-video rounded-lg overflow-hidden mb-4">
      <Image src={imageUrl} alt={title} fill className="object-contain" />
    </div>
    {content && (
      <div className="prose text-text-body text-base leading-relaxed text-center">
        <SafeContent html={content} />
      </div>
    )}
  </div>
);

export default ImageCard;
