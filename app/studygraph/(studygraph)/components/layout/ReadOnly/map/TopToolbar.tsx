/**
 * @file TopToolbar.tsx (Read onyl)
 * @description
 *   Renders the top‐right toolbar for CanvasView, containing:
 *     • Search button
 *     • Share button
 *     • Slideshow button (opens a dropdown with “View All Slides” and “View Flash Cards”)
 *     • “More options” toggle (three dots) that reveals a single‐column dropdown with
 *
 *   Responsibilities:
 *     – Position itself at the top-right of the CanvasView.
 *     – Wire each button to its provided callback.
 *     – Manage open/close state of both dropdowns; close when clicking outside.
 *     – Conditionally render Quiz entry only in “conceptMap” view.
 *     – Show icon + label in a vertical list for each dropdown.
 *     – Display tooltip/title showing the Windows/Mac shortcut only.
 *     – Listen for global keydown events to trigger Undo, Redo, and Quiz.
 */

import React, { useState, useEffect, useRef, KeyboardEvent, useCallback } from 'react';
import {
  SearchButton,
  MenuToggleButton,
} from '@/app/studygraph/(studygraph)/components/layout/Canvas/toolbar/ToolBarButtons';
import { useLayoutContext } from '@/app/Library/Context/LayoutProvider';
import { setGetLayout } from '@/app/Library/Context/LayoutActions';
import {
  MousePointer,
  Monitor,
} from 'lucide-react';
import '@/app/studygraph/(studygraph)/components/layout/Canvas/toolbar/CanvasToolbar.css';

export interface TopToolbarProps {
  /** Which view is currently active: 'conceptMap' or 'pdf' */
  activeView?: 'conceptMap' | 'pdf';

  /** Callback to open the global search modal */
  onSearch: () => void;

  /** Whether multi-select mode is enabled */
  multiSelectEnabled: boolean;
  /** Toggles multi-select mode on/off */
  toggleMultiSelectEnabled: () => void;

  /** Opens the “View All Slides” view */
  onViewAllSlides: () => void;
  /** Opens the “View Flash Cards” view */
  onViewFlashCards: () => void;
}

/**
 * Helper: returns true if the user pressed “Ctrl+Z” (Windows/Linux)
 * or “⌘+Z” (Mac) without any extra modifier.
 */
function isUndoShortcut(e: KeyboardEvent) {
  return (
    (e.ctrlKey && !e.shiftKey && !e.altKey && e.code === 'KeyZ') ||
    (e.metaKey && !e.shiftKey && !e.altKey && e.code === 'KeyZ')
  );
}

/**
 * Helper: returns true if the user pressed “Ctrl+Y” (Win) or
 * “Ctrl+Shift+Z” / “⌘+Shift+Z” (Mac).
 */
function isRedoShortcut(e: KeyboardEvent) {
  return (
    (e.ctrlKey && !e.altKey && e.code === 'KeyY') ||
    ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.code === 'KeyZ')
  );
}

/**
 * Helper: returns true if the user pressed “Ctrl+Q” (Win) or “⌘+Q” (Mac).
 * Note: Cmd+Q on Mac normally quits apps, but here we override to open Quiz.
 */
function isQuizShortcut(e: KeyboardEvent) {
  return (
    (e.ctrlKey && !e.shiftKey && !e.altKey && e.code === 'KeyQ') ||
    (e.metaKey && !e.shiftKey && !e.altKey && e.code === 'KeyQ')
  );
}

const TopToolbar: React.FC<TopToolbarProps> = ({
  activeView,
  onSearch,
  multiSelectEnabled,
  toggleMultiSelectEnabled,
  onViewAllSlides,
  onViewFlashCards,
}) => {
  const { dispatch: layoutDispatch } = useLayoutContext();

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreWrapperRef = useRef<HTMLDivElement>(null);

  const [isSlideMenuOpen, setIsSlideMenuOpen] = useState(false);
  const slideWrapperRef = useRef<HTMLDivElement>(null);

  const handleToggleMultiSelect = useCallback(() => {
    layoutDispatch(setGetLayout(true));
    toggleMultiSelectEnabled();
  }, [layoutDispatch, toggleMultiSelectEnabled]);



  /**
   * Close “More options” dropdown when clicking outside of it.
   */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        moreWrapperRef.current &&
        !moreWrapperRef.current.contains(event.target as Node)
      ) {
        setIsMoreMenuOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  /**
   * Close “Slideshow” dropdown when clicking outside of it.
   */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        slideWrapperRef.current &&
        !slideWrapperRef.current.contains(event.target as Node)
      ) {
        setIsSlideMenuOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  /**
   * Listen for keydown events to fire Undo, Redo, Quiz.
   * (Multi-select via Ctrl+Click / ⌘+Click is handled elsewhere.)
   */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Skip if focus is in an input, textarea, or contentEditable
      const tag = (e.target as HTMLElement).tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown as any);
    return () => window.removeEventListener('keydown', handleKeyDown as any);
  }, [activeView]);

  return (
    <div className="top-toolbar">
      {/* 1. Search Button */}
      <SearchButton onClick={onSearch} />

      {/* 3. Slideshow Button */}
      <div style={{ position: 'relative' }} ref={slideWrapperRef}>
        <button
          onClick={() => setIsSlideMenuOpen((prev) => !prev)}
          className="toolbar-btn"
          title="Slideshow"
          aria-label="Slideshow"
        >
          <Monitor size={20} />
        </button>
        <div className={`menu-dropdown ${isSlideMenuOpen ? 'show' : ''}`}>
          <button
            onClick={() => {
              onViewAllSlides();
              setIsSlideMenuOpen(false);
            }}
            className="menu-item"
          >
            View All Slides
          </button>
          <button
            onClick={() => {
              onViewFlashCards();
              setIsSlideMenuOpen(false);
            }}
            className="menu-item"
          >
            View Flash Cards
          </button>
        </div>
      </div>

      {/* 4. “More options” button + dropdown */}
      <div style={{ position: 'relative' }} ref={moreWrapperRef}>
        <MenuToggleButton
          isOpen={isMoreMenuOpen}
          onToggle={() => setIsMoreMenuOpen((prev) => !prev)}
        />

        <div className={`menu-dropdown ${isMoreMenuOpen ? 'show' : ''}`}>

          {/* Multi-Select */}
          <button
            onClick={() => {
              handleToggleMultiSelect();
              setIsMoreMenuOpen(false);
            }}
            className="menu-item"
            title="Ctrl+Click / ⌘+Click"
            aria-label="Toggle Multi-Select"
          >
            <MousePointer size={20} />
            <span>
              {multiSelectEnabled
                ? 'Disable Multi-Select'
                : 'Enable Multi-Select'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopToolbar;
