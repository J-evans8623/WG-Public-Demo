// VHcardDisplay.tsx

/**
 * @file VHcardDisplay.tsx
 * @description
 *   Version-History CardDisplay (read-only) with vertical scrolling enabled.
 *   Minimal changes:
 *     1) Import panel/card CSS to match RO layout hooks.
 *     2) Fix broken className (stray quote) and add `card-body` hook used by CSS.
 *     3) Ensure the panel is a flex column so height contracts resolve, enabling Y-axis scroll.
 */

import React, { useState, useEffect } from 'react';
import NotesTab from './VHnotesTab';
import { useSearchContext } from '@/app/Library/Context/SearchContext';
import VHunifiedHeader from './VHunifiedHeader';

// ✅ Match RO layout styles for .panel, header/rail, and body hooks
import '@/app/studygraph/(studygraph)/components/layout/CardDisplay/v2/CardDisplay.css';

export interface CardDisplayProps {}

type Mode = 'read';

const CardDisplay: React.FC<CardDisplayProps> = () => {
  // 1) Which panel are we in?
  const [mode, setMode] = useState<Mode>('read');
  const { selectedResultIds } = useSearchContext();

  useEffect(() => {
    if (selectedResultIds) setMode('read');
  }, [selectedResultIds]);

  return (
    <div
      className="panel panel--md theme-scope flex flex-col"
      style={{ '--card-display-width': `380px` } as React.CSSProperties}
    >
      <VHunifiedHeader
        activeTab={'notes'}
        onTabChange={() => {}}
        width={380}
      />

      <div className="flex-1 min-h-0 relative">
        {/* ✅ fixed: removed stray quote and added `card-body` hook for CSS parity */}
        <div className="card-body absolute inset-0 pb-16">
          {mode === 'read' && <NotesTab />}
        </div>
      </div>
    </div>
  );
};

export default CardDisplay;
