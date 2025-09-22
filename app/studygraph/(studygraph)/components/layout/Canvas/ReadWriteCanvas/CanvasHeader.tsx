/** bloom-maps\app\studygraph\(studygraph)\components\layout\Canvas\ReadWriteCanvas\CanvasHeader.tsx
 * @file CanvasHeader.tsx
 * @description
 * CanvasHeader is a production-ready, mode-aware header component that consolidates the behaviors
 * of the editable Canvas header and the read-only Canvas header into a single, cohesive implementation.
 * This file is responsible for rendering the top bar of the learning workspace, including: the collapsible
 * navigation toggle, the document title (with inline editing only in edit mode), Lessons and Uploads
 * dropdowns (read-only dropdowns in read-only mode and fully interactive dropdowns in edit mode), and
 * primary action buttons for discussion, lesson start, review start, bookmarking, sharing, version history,
 * and calendar access. The component routes behaviors to existing context providers so no styling or
 * layout regressions occur; it preserves all CSS class names (e.g., canvas-header, ch-nav, ch-menu__item)
 * to ensure pixel-parity with the rest of the application. It emits purposeful console logs for major
 * state changes, enabling better observability across environments without noisy output. With a single
 * prop, `mode`, the parent can render an edit-capable or viewer-only header, minimizing code duplication
 * and removing edge-case divergence between modes while keeping Big-O work at O(1) for all event handlers.
 *
 * Responsibilities:
 * 1) Render a shared visual header for both edit and read-only canvases.
 * 2) Provide inline title editing strictly in edit mode; disable in read-only.
 * 3) Swap between interactive dropdowns and read-only dropdowns based on mode.
 * 4) Expose action callbacks for discuss, share, review, bookmarks, history, and calendar.
 * 5) Preserve existing CSS hooks and accessibility attributes without introducing new dependencies.
 * 6) Provide targeted console logging at key checkpoints for reliable debugging.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Menu,
  ChevronsLeft,
  MessageCircle,
  Play,
  CheckCircle2,
  Bookmark,
  Share2,
  History,
  Lock,
  Loader2,
  Calendar as CalendarIcon,
} from 'lucide-react';

import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useViewSwitch } from '@/app/Library/Context/ViewSwitchContext';

// update - 1: Replace split dropdown implementations with the converged, mode-aware menus
import { UnifiedLessonsDropdown, UnifiedUploadsDropdown } from './DropDownMenu'; // update - 2

import '@/app/studygraph/(studygraph)/components/layout/Canvas/bottomUtilityBar/CanvasHeader.css';

export type UnifiedHeaderMode = 'edit' | 'readonly';

export interface CanvasHeaderProps {
  /** Controls which set of capabilities are enabled in the header (edit vs. read-only). */
  mode: UnifiedHeaderMode;

  /** Saving indicator used only in edit mode; ignored in read-only. */
  isSaving?: boolean;

  /** Left-cluster: menu/panel toggle */
  onMenuToggle?: () => void;

  /** Right-cluster actions */
  onDiscuss: () => void;
  onStartLesson: () => void;
  onStartReview: () => void;
  onBookmark: () => void;
  onShare: () => void;
  onVersionHistory: () => void;
  onOpenCalendar?: () => void;
}

/**
 * @function CanvasHeader
 * @description
 * Renders a unified header that adapts to either edit or read-only workflows using a single prop (`mode`).
 * In edit mode, the user can rename the active lesson, generate or create lessons, upload and select files,
 * and access all primary actions. In read-only mode, title editing is disabled and the Lessons/Uploads menus
 * become view-only navigators. This function limits re-renders by deriving state from context and memoizing
 * props, and it performs only O(1) work per event handler. Logging is concise and only at key transitions.
 */
const CanvasHeader: React.FC<CanvasHeaderProps> = ({
  mode,
  isSaving = false,
  onMenuToggle,
  onDiscuss,
  onStartLesson,
  onStartReview,
  onBookmark,
  onShare,
  onVersionHistory,
  onOpenCalendar,
}) => {
  /* ──────────────────────────────────────────────────────────────────────
   * 1) Context access and derived state (O(1) reads and computations)
   * ────────────────────────────────────────────────────────────────────── */
  const { activeConceptMapId, getLessonModule, updateConceptMapTitle } = useLessonModule();
  const { getVisibility } = useYDoc();
  const { isPanelExpanded, togglePanel } = useViewSwitch();

  // 1.1 Determine privacy state and current title
  const isPrivate = getVisibility() === 'private';
  const lessonModule = getLessonModule();
  const currentMap = useMemo(
    () => lessonModule.conceptMaps.find((c) => c.id === activeConceptMapId),
    [lessonModule.conceptMaps, activeConceptMapId]
  );
  const currentTitle = currentMap?.title || 'Untitled Lesson';

  // 1.2 Title editing (enabled only in edit mode)
  const [isEditing, setIsEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(currentTitle);

  useEffect(() => {
    if (!isEditing) {
      setTitleDraft(currentTitle);
      console.log('[CanvasHeader.tsx][7101] Title sync from context →', currentTitle);
    }
  }, [currentTitle, isEditing]);

  /* ──────────────────────────────────────────────────────────────────────
   * 2) Event handlers (kept O(1))
   * ────────────────────────────────────────────────────────────────────── */

  // 2.1 Menu toggle: prefer local context toggle to preserve app pattern
  const handleMenuClick = useCallback(() => {
    console.log('[CanvasHeader.tsx][7102] Menu toggle clicked');
    // If parent passed a handler, call it; otherwise, use context to keep behavior consistent.
    if (onMenuToggle) onMenuToggle();
    else togglePanel();
  }, [onMenuToggle, togglePanel]);

  // 2.2 Commit title edit (only when mode === 'edit')
  const commitTitleEdit = useCallback(() => {
    if (mode !== 'edit') return; // Guard: never called in read-only via UI, but keep safe
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== currentTitle) {
      console.log('[CanvasHeader.tsx][7103] Commit title', { from: currentTitle, to: trimmed });
      updateConceptMapTitle(activeConceptMapId, trimmed);
    } else {
      console.log('[CanvasHeader.tsx][7104] Title unchanged or empty, skipping commit');
    }
    setIsEditing(false);
  }, [mode, titleDraft, currentTitle, updateConceptMapTitle, activeConceptMapId]);

  // 2.3 Render helper: left icon changes with panel state
  const renderMenuIcon = useCallback(() => {
    return isPanelExpanded ? (
      <ChevronsLeft size={20} className="text-gray-600" />
    ) : (
      <Menu size={20} className="text-gray-600" />
    );
  }, [isPanelExpanded]);

  /* ──────────────────────────────────────────────────────────────────────
   * 3) Render
   * ────────────────────────────────────────────────────────────────────── */
  return (
    <header className="canvas-header brand-ui flex items-center justify-between" data-testid="unified-canvas-header">
      {/* Left cluster: Menu + Title + Mode-aware dropdown nav */}
      <div className="flex items-center">
        {/* 3.1 Menu toggle button */}
        <button
          onClick={handleMenuClick}
          className="btn btn--icon canvas-header__menu"
          title={isPanelExpanded ? 'Collapse menu' : 'Expand menu'}
          aria-label={isPanelExpanded ? 'Collapse menu' : 'Expand menu'}
        >
          {renderMenuIcon()}
        </button>

        {/* 3.2 Title (editable only in edit mode) */}
        <div
          className="canvas-header__titlewrap"
          onClick={() => {
            if (mode === 'edit' && !isSaving) {
              setIsEditing(true);
              console.log('[CanvasHeader.tsx][7105] Start inline title edit');
            } else {
              console.log('[CanvasHeader.tsx][7106] Title click ignored (read-only or saving)');
            }
          }}
          title={isSaving ? 'Saving…' : currentTitle}
          aria-disabled={mode !== 'edit' || isSaving || isEditing}
        >
          <span className="canvas-header__title">{currentTitle}</span>
          {isPrivate && <Lock size={16} className="canvas-header__lock" />}
          {mode === 'edit' && isSaving && (
            <span className="canvas-header__saving" aria-live="polite">
              <Loader2 size={14} className="ch-spin" />
              <span className="ch-saving-text">Saving…</span>
            </span>
          )}
        </div>

        {/* 3.3 Inline title editor overlay (edit mode only) */}
        {mode === 'edit' && isEditing && !isSaving && (
          <div className="canvas-header__editpop">
            <textarea
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => {
                console.log('[CanvasHeader.tsx][7107] Title blur → commit');
                commitTitleEdit();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  console.log('[CanvasHeader.tsx][7108] Title enter → commit');
                  commitTitleEdit();
                } else if (e.key === 'Escape') {
                  console.log('[CanvasHeader.tsx][7109] Title edit canceled via Escape');
                  setIsEditing(false);
                }
              }}
              className="canvas-header__editbox"
              rows={2}
              autoFocus
            />
          </div>
        )}

        {/* 3.4 Lessons / Uploads navigation (mode-aware) */}
        <nav className="ch-nav" aria-label="Header navigation">
          {/* update - 3: Converged dropdowns with single source of truth */}
          <UnifiedLessonsDropdown mode={mode} /> {/* update - 4 */}
          <UnifiedUploadsDropdown mode={mode} /> {/* update - 5 */}
        </nav>
      </div>

      {/* Right cluster: action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            console.log('[CanvasHeader.tsx][7110] Discuss clicked');
            onDiscuss();
          }}
          className="btn btn--border"
          title="Discuss"
        >
          <MessageCircle size={16} /> Discuss
        </button>

        <button
          onClick={() => {
            console.log('[CanvasHeader.tsx][7111] Start Lesson clicked');
            onStartLesson();
          }}
          className="btn btn--primary"
        >
          <Play size={16} /> Start Lesson
        </button>

        <button
          onClick={() => {
            console.log('[CanvasHeader.tsx][7112] Start Review clicked');
            onStartReview();
          }}
          className="btn btn--success"
        >
          <CheckCircle2 size={16} /> Start Review
        </button>

        <button
          onClick={() => {
            console.log('[CanvasHeader.tsx][7113] Bookmarks clicked');
            onBookmark();
          }}
          className="btn btn--icon btn--border"
          title="Bookmarks"
          aria-label="Bookmarks"
        >
          <Bookmark size={16} />
        </button>

        <button
          onClick={() => {
            console.log('[CanvasHeader.tsx][7114] Share clicked');
            onShare();
          }}
          className="btn btn--icon btn--border"
          title="Share"
          aria-label="Share"
        >
          <Share2 size={16} />
        </button>

        <button
          onClick={() => {
            console.log('[CanvasHeader.tsx][7115] Version History clicked');
            onVersionHistory();
          }}
          className="btn btn--icon btn--border"
          title="History"
          aria-label="History"
        >
          <History size={16} />
        </button>

        <button
          onClick={() => {
            if (onOpenCalendar) {
              console.log('[CanvasHeader.tsx][7116] Calendar clicked → handler');
              onOpenCalendar();
            } else {
              console.log('[CanvasHeader.tsx][7117] Calendar clicked → no handler configured');
            }
          }}
          className="btn btn--icon btn--border"
          title="Calendar"
          aria-label="Calendar"
        >
          <CalendarIcon size={18} />
        </button>
      </div>
    </header>
  );
};

export default CanvasHeader;
