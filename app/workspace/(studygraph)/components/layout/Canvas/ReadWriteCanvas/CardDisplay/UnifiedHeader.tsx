// bloom-maps/app/workspace/(studygraph)/components/layout/Canvas/ReadWriteCanvas/CardDisplay/UnifiedHeader.tsx

/***************************************************************************************
 * @file UnifiedHeader.tsx
 * @description
 *   This header drives the right-rail (CardDisplay) “Notes / Chat” experience for BOTH read/write
 *   and read-only modes using one implementation and the authoritative **read/write styling**. The
 *   component is intentionally viewer-safe and contains no mutating affordances. It renders: (1) a
 *   Back button when the Chat tab is active, (2) a Topics dropdown in PDF view on the Notes tab that
 *   strictly toggles in-memory selection via existing contexts, and (3) Slideshow and Search buttons
 *   in non-PDF Notes view. We preserve the `.rail-header` container, `.divider` internal rule, and
 *   brand token classes referenced by existing CSS. We also emit focused console logs that annotate
 *   high-signal user actions for observability without noisiness. Handlers are O(1); the Topics menu
 *   renders O(N) over in-memory nodes. This file eliminates previous header forks and removes the
 *   obsolete `canEdit` concept, ensuring DOM/CSS parity and long-term maintainability.  // update - 1
 ***************************************************************************************/

import React, { useEffect, useRef, useState } from 'react';
import { useViewSwitch } from '@/app/Library/Context/pdf/ViewSwitchContext';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useSearchContext } from '@/app/Library/Context/SearchContext';
import BackButton from '../../../CardDisplay/BackButton';
import '@/app/workspace/styles/brand/brand-utilities.css'; // this is correct import path
import '@/app/workspace/(studygraph)/components/layout/CardDisplay/v2/CardDisplay.css'; // this is correct import path
import { useSlideShow } from '@/app/Library/Context/SlideShowContext'; // update - 2

interface UnifiedHeaderProps {
  activeTab: 'notes' | 'chat';
  onTabChange: (t: 'notes' | 'chat') => void;
  width: number;
  onTopicChange?: (topic: string) => void; // kept for API parity though selection uses context // update - 3
}

/**
 * @function TopicsDropdown
 * @description
 *   Renders a tokenized Topics dropdown used **only in PDF view**. It reads lesson title and node
 *   list from existing contexts and uses the selection context to toggle items. This function does
 *   not mutate any persistent storage; it only updates in-memory selection. It includes click-outside
 *   handling and focused logs that note open/close transitions. Rendering is O(N) over in-memory
 *   nodes; event handlers are O(1). This keeps the header viewer-safe while still being useful.  // update - 4
 */
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
        console.log('[UnifiedHeader.tsx][6104] Topics dropdown closed by outside click'); // update - 5
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div className="rail-topics" ref={wrapperRef}>
      <button
        onClick={() => {
          const next = !open;
          console.log('[UnifiedHeader.tsx][6103] Topics dropdown toggled', { open: next }); // update - 6
          setOpen(next);
        }}
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
                        if (e.target.checked) {
                          console.log('[UnifiedHeader.tsx][6106] Topic selected', { nodeId: n.id, title: n.title }); // update - 7
                          multiSelect(n.id, true);
                          onTopicChange(n.id);
                        } else {
                          console.log('[UnifiedHeader.tsx][6107] Topic deselected', { nodeId: n.id, title: n.title }); // update - 8
                          deselectNode(n.id);
                          onTopicChange(n.id);
                        }
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

/**
 * @function UnifiedHeader
 * @description
 *   Displays the viewer-safe header surface for the right rail. The function determines which
 *   controls to show based on the active tab and whether the current view is PDF. For Notes in
 *   non-PDF view, it exposes Slideshow and Search; for Notes in PDF, it exposes Search and Topics.
 *   When Chat is active, a Back button returns to Notes. All actions are O(1) and instrumented with
 *   concise logs to document critical user intents without noise. No persistent mutations occur here. // update - 9
 */
const UnifiedHeader: React.FC<UnifiedHeaderProps> = ({
  activeTab,
  onTabChange,
  width, // reserved – not used presently
  onTopicChange,
}) => {
  const { activeView } = useViewSwitch();
  const { open: openSearchModal } = useSearchContext();
  const { openSelectedSlides } = useSlideShow();

  const handleStartSlideshow = () => {
    console.log('[UnifiedHeader.tsx][6102] Start slideshow clicked'); // update - 10
    openSelectedSlides();
  };

  const handleSearchClick = () => {
    console.log('[UnifiedHeader.tsx][6101] SearchButton clicked'); // update - 11
    openSearchModal();
  };

  return (
    <header className="rail-header relative px-4 pt-3 pb-2" data-testid="carddisplay-unified-header"> {/* update - 12 */}
      <div className="flex justify-between items-center mb-3">
        {/* Left spacer for BackButton parity */}
        <div className="flex items-center">
          {activeTab === 'chat' ? (
            <BackButton
              onClick={() => {
                console.log('[UnifiedHeader.tsx][6105] Back to Notes from Chat'); // update - 13
                onTabChange('notes');
              }}
            />
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
        </div>
      </div>

      {/* Bottom divider, tokenized - now properly positioned below buttons */}
      <div className="rail-header__divider divider" />
    </header>
  );
};

export default UnifiedHeader;
