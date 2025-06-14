// CueCard.tsx

/**
 * @file CueCard.tsx
 * @description
 *   Displays either the title (front) or the content (back) based on `flipped` prop.
 *   When showing the back side, supports inline citations:
 *     • Clickable superscripts open a modal with citation details.
 *   Centers both vertically and horizontally.
 */

import React, { useState } from 'react';
import SafeContent from '../../../utils/SafeContent';
import CitationDialog from '../dialog/CitationDialog';
import type { Citation } from '@/app/Library/Definitions/Definitions';

export interface CueCardProps {
  title: string;
  content: string;
  flipped: boolean;
  /** Optional metadata array for inline citations */
  citations?: Citation[] | null;
}

const CueCard: React.FC<CueCardProps> = ({
  title,
  content,
  flipped,
  citations = null,
}) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Citation | null>(null);

  const handleCitationClick = (index: number) => {
    if (!citations) return;
    const found = citations.find((c) => c.index === index) || null;
    setSelected(found);
    setOpen(true);
  };

  return (
    <>
      <div className="flex flex-col justify-center items-center h-full w-full px-6 pt-10 transition-transform duration-300">
        {!flipped ? (
          <h3 className="text-text-title text-xl font-bold text-center">
            {title}
          </h3>
        ) : (
          <div className="prose text-text-body text-base leading-relaxed text-center">
            <SafeContent
              html={content}
              onCitationClick={handleCitationClick}
            />
          </div>
        )}
      </div>

      <CitationDialog
        isOpen={open}
        citation={selected}
        onClose={() => setOpen(false)}
      />
    </>
  );
};

export default CueCard;
