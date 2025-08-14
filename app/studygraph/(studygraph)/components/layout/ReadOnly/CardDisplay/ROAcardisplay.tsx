/**
 * @file ROCardDisplay.tsx
 * @description
 *   Read-only version of CardDisplay that matches the exact styling and structure
 *   of the main CardDisplay component. This component renders UnifiedHeader and
 *   NotesTab in read-only mode, maintaining visual parity with the editable version
 *   while disabling all mutating operations like "add card" functionality.
 *   The component uses the same branded styling, theme scope, and layout structure
 *   as the main CardDisplay to ensure consistent user experience across read-only
 *   and editable modes.
 */

import React, { useState, useEffect } from 'react';
import NotesTab from './NotesTab';
import UnifiedHeader from '../../CardDisplay/v2/UnifiedHeader';
import { useSelectionAttachment } from '@/app/Library/Context/SelectionAttachmentContext';
import { useSearchContext } from '@/app/Library/Context/SearchContext';
import '../CardDisplay/v2/CardDisplay.css'; // Use same styling as main CardDisplay

export interface ROCardDisplayProps {}

type Mode = 'note'; // Read-only mode only supports notes view

const ROCardDisplay: React.FC<ROCardDisplayProps> = () => {
  // 1) Read-only mode state (no chat or edit modes)
  const [mode, setMode] = useState<Mode>('note');

  // 2) Context hooks for reactive behavior (read-only safe)
  const { isExploreOpen, isQuizOpen } = useSelectionAttachment();
  const { selectedResultIds } = useSearchContext();

  // 3) Auto-switch to notes mode when explore/quiz opens or search results change
  useEffect(() => {
    if (isExploreOpen || isQuizOpen) setMode('note');
  }, [isExploreOpen, isQuizOpen]);

  useEffect(() => {
    if (selectedResultIds.length > 0) setMode('note');
  }, [selectedResultIds]);

  // 4) Read-only tab change handler (only supports notes mode)
  const handleTabChange = (tab: 'notes' | 'chat') => {
    // In read-only mode, only allow notes tab
    if (tab === 'notes') {
      setMode('note');
    }
    console.log('[ROCardDisplay.tsx][6001] Tab change requested:', tab, '(read-only: notes only)');
  };

  // 5) No-op handlers for read-only mode (maintain interface compatibility)
  const handleTopicChange = () => {
    console.log('[ROCardDisplay.tsx][6002] Topic change requested (read-only: no-op)');
  };

  return (
    <div className="panel panel--md theme-scope" data-theme="warm-board">
      {/* Header: Use same UnifiedHeader as main CardDisplay but in read-only mode */}
      <UnifiedHeader
        activeTab="notes" // Always show notes tab as active in read-only mode
        onTabChange={handleTabChange}
        width={380}
        onTopicChange={handleTopicChange}
      />

      {/* Content body: Same structure as main CardDisplay */}
      <div className="flex-1 min-h-0 relative">
        <div className="card-body absolute inset-0">
          {/* Only render NotesTab in read-only mode */}
          <NotesTab />
        </div>
      </div>

      {/* No ActionFooter in read-only mode - this is the key difference */}
      {/* ActionFooter would normally contain "Add Resource" and edit controls */}
    </div>
  );
};

export default ROCardDisplay;