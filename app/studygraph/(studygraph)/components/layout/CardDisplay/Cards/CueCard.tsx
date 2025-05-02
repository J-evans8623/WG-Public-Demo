// CueCard.tsx

import React from 'react';
import SafeContent from '../../../utils/SafeContent';

export interface CueCardProps {
  title: string;
  content: string;
  flipped: boolean;
}

/**
 * @file CueCard.tsx
 * @description
 *   Displays either the title (front) or the content (back) based on `flipped` prop.
 *   Centers both vertically and horizontally.
 */
const CueCard: React.FC<CueCardProps> = ({ title, content, flipped }) => (
  <div className="flex flex-col justify-center items-center h-full w-full px-6 pt-10 transition-transform duration-300">
    { !flipped ? (
      <h3 className="text-text-title text-xl font-bold text-center">{title}</h3>
    ) : (
      <div className="prose text-text-body text-base leading-relaxed text-center">
        <SafeContent html={content} />
      </div>
    )}
  </div>
);

export default CueCard;
