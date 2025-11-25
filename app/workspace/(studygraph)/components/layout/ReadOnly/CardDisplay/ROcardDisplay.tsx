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
import ChatTab from '../../CardDisplay/v2/ChatTab';
import { useSearchContext } from '@/app/Library/Context/SearchContext';
import '@/app/workspace/(studygraph)/components/layout/CardDisplay/v2/CardDisplay.css'; // Existing styling overrides for panel, header, footer
import UnifiedHeader from './ROunifiedHeader';
import ActionFooter from '../../CardDisplay/v2/ROactionFooter';

export interface CardDisplayProps {askHandler: ()=> void}

type Mode = 'note' | 'chat';

const CardDisplay: React.FC<CardDisplayProps> = ({askHandler}) => {
  // 1) Which panel are we in?
  const [mode, setMode] = useState<Mode>('note');
  const { selectedResultIds } = useSearchContext();

  useEffect(() => {
    if (selectedResultIds) setMode('note');
  }, [selectedResultIds]);

 
 // 6) Tab switching must clean up any in‐progress edit
  const handleTabChange = (tab: 'notes' | 'chat') => {

    setMode(tab === 'chat' ? 'chat' : 'note');
  };
  
  return(
    <div className="panel panel--md theme-scope" data-theme="warm-board">
      {/* Header: tokenized rail surface */}
      <UnifiedHeader
        activeTab={mode === 'chat' ? 'chat' : 'notes'}
        onTabChange={handleTabChange}
        width={380}
      />

      {/* Content body (absolute inset wrapper preserved) */}
      <div className="flex-1 min-h-0 relative">
        <div className={`card-body absolute inset-0 ${mode !== 'chat' ? 'has-footer' : ''}`}>
          {mode === 'chat' && <ChatTab />}

          {mode === 'note' && (
            <NotesTab/>
          )}
        </div>
      </div>

      {mode !== 'chat' && (
        <ActionFooter
          askHandler={askHandler}
        />
      )}
    </div>
  );
};

export default CardDisplay;

