/***************************************************************************************
 * @file UnifiedHeader.tsx
 * @description
 *   Header bar for the notes / chat pane.
 *   ▸ Deprecates the Font-size button (design decision – removed import & logic).
 *   ▸ Changes the active-tab highlight so it contrasts with the pane colour:
 *       – inactive / hover  : var(--left-pane-bg)  (very light)
 *       – active            : var(--header-bg)     (a step darker)
 *   ▸ Retains the floating-tabs look, internal 1 px divider and Topics dropdown.
 *
 *   Responsibilities
 *     1. Render and switch “Notes / Chat” tabs.
 *     2. Show TopicsDropdown in PDF view (Notes tab only).
 *     3. Provide internal bottom divider (not flush to map edge).
 ***************************************************************************************/

import React, { useEffect, useRef, useState } from 'react';
import { useViewSwitch } from '@/app/Library/Context/pdf/ViewSwitchContext';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import '@/app/studygraph/(studygraph)/components/layout/mapTheme.css';
import BackButton from './BackButton';
import SearchButton from './SearchButton';
import { useSearchContext } from '@/app/Library/Context/SearchContext';
/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface UnifiedHeaderProps {
  activeTab: 'notes' | 'chat';
  onTabChange: (t: 'notes' | 'chat') => void;
  width: number;
  onTopicChange: (topic: string) => void;
}

/* -------------------------------------------------------------------------- */
/* Topics dropdown (PDF mode only)                                            */
/* -------------------------------------------------------------------------- */

const TopicsDropdown: React.FC<{
  onTopicChange: (t: string) => void;
}> = ({ onTopicChange }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  /* lesson context ------------------------------------------------------ */
  const { activeConceptMapId, getLessonModule } = useLessonModule();
  const lesson = getLessonModule().conceptMaps.find(c => c.id === activeConceptMapId);
  const lessonTitle = lesson ? lesson.title : 'Untitled Lesson';

  /* nodes for list ------------------------------------------------------- */
  const { nodes } = useNodesContext();
  const { isSelected, multiSelect, deselectNode } = useNodeSelection();
  const nodeArr = Array.from(nodes.values());

  /* close dropdown on outside click ------------------------------------- */
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (open && wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  /* render --------------------------------------------------------------- */
  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="
          flex items-center gap-1 px-4 py-1.5 rounded-md text-sm
          bg-[var(--left-pane-bg)] hover:bg-[var(--bg-selected)]
        "
      >
        <span>Topics</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded shadow-lg z-10">
          <div className="px-4 py-1 text-xs text-slate-600">{lessonTitle}</div>
          <div className="border-t border-slate-200 mx-2" />

          <div className="p-2 overflow-y-auto max-h-24 custom-scrollbar">
            {nodeArr.length === 0 ? (
              <div className="p-2 text-sm text-gray-500">No topics available.</div>
            ) : (
              nodeArr.map(node => {
                const checked = isSelected(node.id);
                return (
                  <label
                    key={node.id}
                    className="flex items-center p-2 hover:bg-gray-100 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="w-3 h-3 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                      checked={checked}
                      onChange={e => {
                        if (e.target.checked) multiSelect(node.id, true);
                        else deselectNode(node.id);
                      }}
                    />
                    <span className="ml-2 text-xs text-slate-800">{node.title}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* UnifiedHeader component                                                    */
/* -------------------------------------------------------------------------- */

const UnifiedHeader: React.FC<UnifiedHeaderProps> = ({
  activeTab,
  onTabChange,
  width, // reserved – not used presently
  onTopicChange,
}) => {
  const { activeView } = useViewSwitch();
  const { open: openSearchModal } = useSearchContext();

  return (
    <header
      className="
        relative
        bg-[var(--header-tint)]
        px-4 pt-3 pb-2    /* ↑ 4 px extra top padding */
        flex justify-between items-center
      "
    >
      {/* Left side: BackButton (chat) or placeholder (notes) */}
      <div className="flex items-center">
        {activeTab === 'chat' ? (
          <BackButton onClick={() => onTabChange('notes')} />
        ) : (
          <div style={{ width: '64px' }} /> /* reserve space */
        )}
      </div>

      
      
      {/* Contextual controls (FontSizeButton removed) --------------------- */}
      <div className="flex items-center gap-2">
         {activeTab === 'notes' && (
          <SearchButton onClick={() => {
            console.log('[UnifiedHeader.tsx][6001] › SearchButton clicked');
            openSearchModal();
          }} />
        )}
        {activeTab === 'notes' && activeView === 'pdf' && (
          <TopicsDropdown onTopicChange={onTopicChange} />
        )}
      </div>

      {/* Internal divider -------------------------------------------------- */}
      <div className="absolute bottom-0 left-0 w-full h-px bg-[var(--divider-color)]" />
    </header>
  );
};

export default UnifiedHeader;
