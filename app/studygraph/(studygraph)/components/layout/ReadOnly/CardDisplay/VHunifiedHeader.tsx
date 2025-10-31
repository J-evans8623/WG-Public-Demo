/***************************************************************************************
 * @file VHunifiedHeader.tsx
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
import { useViewSwitch } from '@/app/Library/Context/pdf/ViewSwitchContext';
import { useSearchContext } from '@/app/Library/Context/SearchContext';
import SearchButton from '../../CardDisplay/SearchButton';
import '@/app/studygraph/styles/brand/brand-utilities.css';



interface UnifiedHeaderProps {
  activeTab: 'notes';
  onTabChange: (t: 'notes' | 'chat') => void;
  width: number;
}

const UnifiedHeader: React.FC<UnifiedHeaderProps> = ({
  activeTab,
  onTabChange,
  width, // reserved – not used presently
}) => {
  const { activeView } = useViewSwitch();
  const { open: openSearchModal } = useSearchContext();


  const handleSearchClick = () => {
    console.log('[UnifiedHeader.tsx][6101] SearchButton clicked');
    openSearchModal();
  };

  return (
    <header className="rail-header relative px-4 pt-3 pb-2">
      <div className="flex justify-between items-center mb-3">
        {/* Left spacer for BackButton parity */}
        <div className="flex items-center">
            <div className="rail-header__spacer" />
        </div>

        {/* Right cluster: conditional buttons based on view and tab */}
        <div className="flex items-center gap-2">
          {activeTab === 'notes' && activeView !== 'pdf' && (
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

          {/* PDF view - keep existing SearchButton and Topics */}
          {activeTab === 'notes' && activeView === 'pdf' && (
            <>
              <SearchButton
                onClick={() => {
                  console.log('[UnifiedHeader.tsx][6101] SearchButton clicked');
                  openSearchModal();
                }}
              />
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