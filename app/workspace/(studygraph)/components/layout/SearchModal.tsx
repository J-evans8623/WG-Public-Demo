// src/app/workspace/(studygraph)/components/layout/SearchModal.tsx
// src/app/workspace/(studygraph)/components/layout/SearchModal.tsx

import React, { useEffect, useRef, KeyboardEvent, MouseEvent } from 'react';
import ReactDOM from 'react-dom';
import { useSearchContext } from '@/app/Library/Context/SearchContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Helper to remove any HTML tags from a string.
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

/**
 * @file SearchModal.tsx
 * @description
 *   Renders the search modal via portal into #modal-root.
 *   Consumes live results from SearchContext.
 *   Clicking a result selects it and closes modal.
 *   Supports closing via ESC, overlay click, or "X" button.
 *   Traps focus within the modal and announces role="dialog".
 *   
 *   Now displays concept node title + resource card title with proper visual hierarchy.
 *
 * Responsibilities:
 *   - Centered compact modal matching prototype footprint.
 *   - Live-updating result list; empty-state prompt.
 *   - Display concept node title (more prominent) + resource card title.
 *   - Accessible: role="dialog", aria-modal, focus trap.
 *   - Footer hint for ESC.
 */
const SearchModal: React.FC = () => {
  const {
    isOpen,
    query,
    results,
    setQuery,
    selectResult,
    close,
  } = useSearchContext();

  const { nodes } = useNodesContext();
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusableElementsRef = useRef<HTMLElement[]>([]);

  // Close on ESC and manage focus trap
  useEffect(() => {
    if (!isOpen) return;

    // Focus the search input on open
    inputRef.current?.focus();

    const modal = modalRef.current!;
    // Gather focusable elements inside modal
    focusableElementsRef.current = Array.from(
      modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
    );

    const handleKeyDown = (e: KeyboardEvent | globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'Tab') {
        // Focus trap logic
        const focusables = focusableElementsRef.current;
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown as any);
    return () => {
      document.removeEventListener('keydown', handleKeyDown as any);
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) {
      close();
    }
  };

  const handleResultClick = (id: string) => {
    selectResult(id);
  };

  // Helper to get node title from nodeId
  const getNodeTitle = (nodeId: string): string => {
    const node = nodes.get(nodeId);
    return node?.title || 'Unknown Topic';
  };

  const modal = (
    <div
      ref={overlayRef}
      onMouseDown={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black bg-opacity-50"
      aria-hidden="true"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-modal-label"
        className="bg-white rounded-md shadow-lg w-full max-w-md max-h-[70vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <h2 id="search-modal-label" className="text-lg font-medium">
            Search
          </h2>
          <button
            onClick={close}
            aria-label="Close search"
            className="p-1 rounded hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {/* Input */}
        <div className="px-4 py-2 border-b">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cards..."
            aria-label="Search cards"
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring"
          />
        </div>

        {/* Results */}
        <ul className="flex-1 overflow-y-auto">
          {query.trim() === '' ? (
            <li className="px-4 py-6 text-center text-gray-500">
              Type to search
            </li>
          ) : results.length === 0 ? (
            <li className="px-4 py-6 text-center text-gray-500">
              No results
            </li>
          ) : (
            results.map((card) => {
              let rawText = '';
              if ('description' in card && typeof (card as any).description === 'string') {
                rawText = (card as any).description;
              } else if (typeof (card as any).content === 'string') {
                rawText = (card as any).content;
              } else {
                rawText = JSON.stringify((card as any).content) ?? '';
              }
              const displayText = stripHtml(rawText);
              const nodeTitle = getNodeTitle(card.nodeId);

              return (
                <li
                  key={card.id}
                  onClick={() => handleResultClick(card.id)}
                  className="px-4 py-2 border-b last:border-b-0 hover:bg-gray-100 cursor-pointer"
                >
                  {/* Concept Node Title - More prominent */}
                  <div className="font-semibold text-base text-gray-900 mb-0.5">
                    {nodeTitle}
                  </div>
                  
                  {/* Resource Card Title - Slightly less prominent */}
                  <div className="font-medium text-sm text-gray-700">
                    {card.title}
                  </div>
                  
                  {/* Content preview - Subtle */}
                  <div className="text-xs text-gray-500 truncate mt-1">
                    {displayText}
                  </div>
                </li>
              );
            })
          )}
        </ul>

        {/* Footer */}
        <div className="px-4 py-2 border-t text-xs text-center text-gray-500">
          Press ESC to close
        </div>
      </div>
    </div>
  );

  const container = document.getElementById('modal-root');
  if (!container) {
    console.error('SearchModal: #modal-root not found');
    return null;
  }

  return ReactDOM.createPortal(modal, container);
};

export default SearchModal;