/**
 * @file NoteCard.tsx
 * @description
 *   Note card body (no footer).  Heading + body text.
 */

import React from 'react';
import SafeContent from '../../../utils/SafeContent';

export interface NoteCardProps {
  title: string;
  content: string;
}

const NoteCard: React.FC<NoteCardProps> = ({ title, content }) => (
  <div>
    <h3 className="text-text-title text-xl font-bold text-center mb-4">
      {title}
    </h3>
    <div className="prose text-text-body text-base leading-relaxed text-start">
      <SafeContent html={content} />
    </div>
  </div>
);

export default NoteCard;
