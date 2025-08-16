/***************************************************************************************
 * @file UnifiedHeader.tsx
 * @description
 *   Right-rail header for Notes/Chat. Phase 2 replaces color utilities and ad-hoc rgba/hex
 *   with semantic classes powered by tokens and brand utilities. The surface now uses the
 *   tokenized .rail-header container, the internal rule is .divider, and the Topics menu
 *   adopts shared chip/field/menu primitives (no inline colors). Keyboard/ARIA behaviors
 *   are preserved; layout utilities remain allowed. We also add purposeful logging for
 *   search clicks and chip interactions while avoiding verbosity.
 *
 *   Updated to include "Start slideshow" and "Search" buttons for notes tab view.
 *
 *   Responsibilities
 *     1. Render and switch "Notes / Chat" tabs.
 *     2. Show Topics dropdown in PDF view (Notes tab only) using tokenized menu styles.
 *     3. Show slideshow and search buttons in Notes tab view (non-PDF view).
 *     4. Provide internal bottom divider via .divider and scoped header styling.
 ***************************************************************************************/

import React, { useEffect, useRef, useState } from 'react';
import { useViewSwitch } from '@/app/Library/Context/ViewSwitchContext';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useSearchContext } from '@/app/Library/Context/SearchContext';
import SearchButton from '../SearchButton';
import BackButton from '../BackButton';
import '@/app/studygraph/styles/brand/brand-utilities.css';
import './CardDisplay.css';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';


interface UnifiedHeaderProps {
  activeTab: 'notes' | 'chat';
  onTabChange: (t: 'notes' | 'chat') => void;
  width: number;
  onTopicChange: (topic: string) => void;
}

/* Topics dropdown (PDF mode only) */
const TopicsDropdown: React.FC<{ onTopicChange: (t: string) => void }> = ({ onTopicChange }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  

  // 1) lesson context for label
  const { activeConceptMapId, getLessonModule } = useLessonModule();
  const lesson = getLessonModule().conceptMaps.find(c => c.id === activeConceptMapId);
  const lessonTitle = lesson ? lesson.title : 'Untitled Lesson';

  // 2) nodes and selection helpers
  const { nodes } = useNodesContext();
  const { isSelected, multiSelect, deselectNode } = useNodeSelection();
  const nodeArr = Array.from(nodes.values());

  // 3) click-outside to close
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (open && wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div className="rail-topics" ref={wrapperRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="chip chip--action"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span>Topics</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24">
          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div role="menu" className="rail-menu rail-topics__menu">
          <div className="rail-menu__section">{lessonTitle}</div>
          <div className="divider" />

          <div className="p-2 max-h-48 overflow-y-auto scrollbar--thin">
            {nodeArr.length === 0 ? (
              <div className="p-2 text-xs" style={{ color: 'var(--muted)' }}>No topics available.</div>
            ) : (
              nodeArr.map(n => {
                const checked = isSelected(n.id);
                return (
                  <label key={n.id} className="rail-menu__item flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rail-check"
                      checked={checked}
                      onChange={e => {
                        if (e.target.checked) multiSelect(n.id, true);
                        else deselectNode(n.id);
                      }}
                    />
                    <span className="text-xs" style={{ color: 'var(--ink)' }}>{n.title}</span>
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

const UnifiedHeader: React.FC<UnifiedHeaderProps> = ({
  activeTab,
  onTabChange,
  width, // reserved – not used presently
  onTopicChange,
}) => {
  const { activeView } = useViewSwitch();
  const { open: openSearchModal } = useSearchContext();
  const {openSelectedSlides} = useSlideShow();

  const handleStartSlideshow = () => {
    console.log('[UnifiedHeader.tsx][6102] Start slideshow clicked');
    openSelectedSlides()
  };

  const handleSearchClick = () => {
    console.log('[UnifiedHeader.tsx][6101] SearchButton clicked');
    openSearchModal();
  };

  return (
    <header className="rail-header relative px-4 pt-3 pb-2">
      <div className="flex justify-between items-center mb-3">
        {/* Left spacer for BackButton parity */}
        <div className="flex items-center">
          {activeTab === 'chat' ? (
            <BackButton onClick={() => onTabChange('notes')} />
          ) : (
            <div className="rail-header__spacer" />
          )}
        </div>

        {/* Right cluster: conditional buttons based on view and tab */}
        <div className="flex items-center gap-2">
          {activeTab === 'notes' && activeView !== 'pdf' && (
            <>
              {/* Start slideshow button - minimal with brown outline */}
              <button
                onClick={handleStartSlideshow}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all"
                style={{
                  backgroundColor: 'transparent',
                  color: '#8B7355',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  border: '1px solid #D4C4B0',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#FAF8F5';
                  e.currentTarget.style.borderColor = '#8B7355';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = '#D4C4B0';
                }}
                title="Start slideshow"
                aria-label="Start slideshow"
              >
                <span>Slideshow</span>
                <svg 
                  viewBox="0 0 24 24" 
                  fill="currentColor"
                  className="w-4 h-4"
                  style={{ color: '#8B7355' }}
                >
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              </button>

              {/* Search button - minimal with brown outline */}
              <button
                onClick={handleSearchClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all"
                style={{
                  backgroundColor: 'transparent',
                  color: '#8B7355',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  border: '1px solid #D4C4B0',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#FAF8F5';
                  e.currentTarget.style.borderColor = '#8B7355';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = '#D4C4B0';
                }}
                title="Search"
                aria-label="Search"
              >
                <span>Search</span>
                <svg 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                  className="w-4 h-4"
                  style={{ color: '#8B7355' }}
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              </button>
            </>
          )}

          {/* PDF view - keep existing SearchButton and Topics */}
          {activeTab === 'notes' && activeView === 'pdf' && (
            <>
              <SearchButton
                onClick={() => {
                  console.log('[UnifiedHeader.tsx][6101] SearchButton clicked');
                  openSearchModal();
                }}
              />
              <TopicsDropdown onTopicChange={onTopicChange} />
            </>
          )}
        </div>
      </div>

      {/* Bottom divider, tokenized - now properly positioned below buttons */}
      <div className="rail-header__divider divider" />
    </header>
  );
};

export default UnifiedHeader;