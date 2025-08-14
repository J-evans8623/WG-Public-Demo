/**
 * @file CanvasHeader.tsx
 * @description
 * The Canvas header renders the main application controls at the top of the canvas area and is the
 * first component fully migrated to tokenized, theme-scoped styling. This implementation introduces
 * two product navigation dropdowns (“Lessons” and “Uploads”) beside the editable document title and
 * adds a Calendar icon button to the right-side actions. The dropdowns are accessible (role="menu",
 * aria-expanded, click-outside + Escape to close), keyboard-friendly for dismissal, and intentionally
 * leave action handlers as no-ops for now while providing purposeful console logs. The visual design
 * is powered entirely by semantic CSS classes bound to CSS tokens (bg/surface/ink/edge/accents) so
 * that active theme scopes control palette without Tailwind color utilities. Logging is limited to
 * high-value checkpoints (menu toggles, button presses, title commit) and tagged with file+codes.
 *
 * Responsibilities:
 *   1) Provide accessible, inline editing of the lesson title with focus, escape, and commit on Enter.
 *   2) Surface a saving indicator bound to autosave state, without blocking pointer interactions.
 *   3) Render primary/secondary action buttons using semantic `.btn` variants tied to tokens.
 *   4) Render Lessons/Uploads dropdown menus with ARIA, tokenized styling, and safe close behaviors.
 *   5) Include a Calendar button in the right action cluster, ready for integration in a later phase.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Menu,
  MessageCircle,
  Play,
  CheckCircle2,
  Bookmark,
  Share2,
  History,
  Lock,
  Loader2,
  Calendar as CalendarIcon
} from 'lucide-react';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import './CanvasHeader.css';
import ShareAccessModal from '../../../share/ShareAccessModal';

export interface CanvasHeaderProps {
  onMenuToggle: () => void;
  onDiscuss: () => void;
  onStartLesson: () => void;
  onStartReview: () => void;
  onBookmark: () => void;
  onShare: () => void;
  onVersionHistory: () => void;
  /** Optional: we’ll wire this later; logging is provided if omitted */
  onOpenCalendar?: () => void;
  isSaving: boolean;
}

/**
 * @function useClickOutside
 * @description
 *   Small utility hook that sets up a document-level pointer listener to detect clicks occurring
 *   outside of the referenced element. When such a click is detected, the provided `onOutside` callback
 *   is invoked exactly once per interaction. This hook supports dropdown and popover dismissal, ensures
 *   pointer events don’t leak when the ref is not yet mounted, and tears down listeners on unmount.
 *   It does not stop propagation and is purely additive, preserving ambient handlers elsewhere.
 */
function useClickOutside(ref: React.RefObject<HTMLElement>, onOutside: () => void) {
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [ref, onOutside]);
}

/**
 * @function HeaderMenu
 * @description
 *   Reusable dropdown menu used by “Lessons” and “Uploads” triggers. It renders a tokenized panel
 *   with role="menu" and simple list of actionable items (as buttons). It manages open/close state,
 *   provides Escape-to-close behavior, and exposes purposeful console logs for item selection so
 *   downstream wiring can be added later without modifying layout or visual details. The trigger is
 *   a semantic button that reflects expanded state via aria attributes and a chevron icon.
 */
const HeaderMenu: React.FC<{
  label: 'Lessons' | 'Uploads';
  items: { id: string; label: string }[];
  onItemSelect?: (id: string) => void;
}> = ({ label, items, onItemSelect }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useClickOutside(wrapRef, () => setOpen(false));
  const [isShareOpen, setShareOpen] = useState(false);
const shareLink = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="ch-nav__item" ref={wrapRef}>
      <button
        type="button"
        className="ch-nav__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen(o => !o);
          console.log(`[CanvasHeader.tsx][4241] ${label} menu toggled →`, !open);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      >
        <span>{label}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="ch-menu"
          aria-label={`${label} menu`}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
        >
          {items.map(it => (
            <button
              key={it.id}
              role="menuitem"
              className="ch-menu__item"
              onClick={() => {
                console.log(`[CanvasHeader.tsx][4242] ${label} menu item selected:`, it.id);
                onItemSelect?.(it.id);
                setOpen(false);
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const CanvasHeader: React.FC<CanvasHeaderProps> = ({
  onMenuToggle,
  onDiscuss,
  onStartLesson,
  onStartReview,
  onBookmark,
  onShare,
  onVersionHistory,
  onOpenCalendar,
  isSaving,
}) => {
  const { activeConceptMapId, getLessonModule, updateConceptMapTitle } = useLessonModule();
  const { getVisibility } = useYDoc();
  const isPrivate = getVisibility() === 'private';

  const lessonModule = getLessonModule();
  const cm = lessonModule.conceptMaps.find((c) => c.id === activeConceptMapId);
  const currentTitle = cm?.title || 'Untitled Lesson';

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(currentTitle);

  useEffect(() => {
    if (!isEditing) setDraft(currentTitle);
  }, [currentTitle, isEditing]);

  const commit = useCallback(() => {
    const t = draft.trim();
    if (t && t !== currentTitle) {
      console.log('[CanvasHeader.tsx][4201] committing title change:', t);
      updateConceptMapTitle(activeConceptMapId, t);
    }
    setIsEditing(false);
  }, [draft, currentTitle, updateConceptMapTitle, activeConceptMapId]);

  return (
    <header className="canvas-header flex items-center justify-between">
      {/* ───────────────────────── Left cluster: menu, title, nav tabs ───────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            console.log('[CanvasHeader.tsx][4202] menu toggled');
            onMenuToggle();
          }}
          className="btn btn--icon canvas-header__menu"
          title="Toggle menu"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>

        {/* Title display (click to edit) */}
        <div
          className="canvas-header__titlewrap"
          onClick={() => {
            if (!isSaving) {
              console.log('[CanvasHeader.tsx][4203] start inline edit');
              setIsEditing(true);
            }
          }}
          title={isSaving ? 'Saving…' : currentTitle}
          aria-disabled={isSaving || isEditing}
        >
          <span className="canvas-header__title">{currentTitle}</span>
          {isPrivate && <Lock size={16} className="canvas-header__lock" />}
          {isSaving && (
            <span className="canvas-header__saving" aria-live="polite">
              <Loader2 size={14} className="ch-spin" />
              <span className="ch-saving-text">Saving…</span>
            </span>
          )}
        </div>

        {/* Inline editor overlay */}
        {isEditing && !isSaving && (
          <div className="canvas-header__editpop">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commit();
                  e.preventDefault();
                }
                if (e.key === 'Escape') {
                  console.log('[CanvasHeader.tsx][4204] cancel inline edit');
                  setIsEditing(false);
                }
              }}
              className="canvas-header__editbox"
              rows={2}
              autoFocus
            />
          </div>
        )}

        {/* New: tokenized nav tabs with dropdowns (Lessons / Uploads) */}
        <nav className="ch-nav" aria-label="Header menu">
          <HeaderMenu
            label="Lessons"
            items={[
              { id: 'new', label: 'New Lesson' },
              { id: 'open-recent', label: 'Open Recent' },
              { id: 'duplicate', label: 'Duplicate Lesson' },
              { id: 'export-slides', label: 'Export Slides' },
            ]}
            onItemSelect={(id) => {
              // Placeholder wiring – keep for Phase 2
              console.log('[CanvasHeader.tsx][4243] Lessons action:', id);
            }}
          />
          <HeaderMenu
            label="Uploads"
            items={[
              { id: 'upload-pdf', label: 'Upload PDF' },
              { id: 'upload-image', label: 'Upload Image' },
              { id: 'upload-audio', label: 'Upload Audio' },
              { id: 'manage-files', label: 'Manage Files' },
            ]}
            onItemSelect={(id) => {
              // Placeholder wiring – keep for Phase 2
              console.log('[CanvasHeader.tsx][4244] Uploads action:', id);
            }}
          />
        </nav>
      </div>

      {/* ───────────────────────── Right cluster: actions ───────────────────────── */}
      <div className="flex items-center gap-2">
        <button onClick={onDiscuss} className="btn btn--border" title="Discuss">
          <MessageCircle size={16} /> Discuss
        </button>
        <button
          onClick={() => {
            console.log('[CanvasHeader.tsx][4205] Start Lesson');
            onStartLesson();
          }}
          className="btn btn--primary"
        >
          <Play size={16} /> Start Lesson
        </button>
        <button
          onClick={() => {
            console.log('[CanvasHeader.tsx][4206] Start Review');
            onStartReview();
          }}
          className="btn btn--success"
        >
          <CheckCircle2 size={16} /> Start Review
        </button>
        <button onClick={onBookmark} className="btn btn--border" title="Bookmarks" aria-label="Bookmarks">
          <Bookmark size={16} />
        </button>
        <button onClick={onShare} className="btn btn--border" title="Share" aria-label="Share">
          <Share2 size={16} />
        </button>
        <button onClick={onVersionHistory} className="btn btn--border" title="History" aria-label="History">
          <History size={16} />
        </button>

        {/* New: Calendar button (placeholder trigger for now) */}
        <button
          onClick={() => {
            if (onOpenCalendar) {
              console.log('[CanvasHeader.tsx][4245] Calendar button pressed → external handler');
              onOpenCalendar();
            } else {
              console.log('[CanvasHeader.tsx][4246] Calendar button pressed (no handler wired yet)');
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
