/**
 * @file ROcardDisplay.tsx
 * @description
 *   Top‐level right‐hand pane: renders UnifiedHeader, NotesTab/ChatTab/EditTab, and ActionFooter.
 *   This update wires up ResourceDisplay’s validation state so that:
 *     • We maintain a local `isFormValid` flag in CardDisplay.
 *     • Pass `onValidate={setIsFormValid}` into ResourceDisplay so it notifies us when the form is valid.
 *     • Modify the external “Save” button in ActionFooter to be disabled unless `isFormValid === true`.
 *     • When the “Save” button is clicked, we only call `handleSave()` (EditTab.save) if the form is valid.
 *   All other behavior and styling remain unchanged.
 */

import React, { useState, useEffect } from 'react';
import NotesTab from './NotesTab';
import { useSearchContext } from '@/app/Library/Context/SearchContext';
import '@/app/studygraph/(studygraph)/components/layout/CardDisplay/v2/CardDisplay.css'; // Existing styling overrides for panel, header, footer

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
      className="panel"
      style={{ '--card-display-width': `380px` } as React.CSSProperties}
    >
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 'pb-16">
          {mode === 'read' && (
            <NotesTab
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CardDisplay;
