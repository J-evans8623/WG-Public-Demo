// CanvasHeader.tsx

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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  MoreVertical,
  Zap,
} from 'lucide-react';

import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useViewSwitch } from '@/app/workspace/(studygraph)/components/layout/Canvas/pdf/ViewSwitchContext';

// Replace split dropdown implementations with the converged, mode-aware menus
import { UnifiedLessonsDropdown, UnifiedUploadsDropdown } from './DropDownMenu'; 
import { useCalendar } from '@/app/Library/Context/CalendarContextv2';

import '@/app/workspace/(studygraph)/components/layout/Canvas/header/CanvasHeader.css';
import { useComments } from '@/app/Library/Context/forum/CommentContext';
import { useAccountStatus } from '@/app/src/context/ApiContext';

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
  onOpenCalendar?: () => void;
  onUpgrade?: () => void;

  // EducatorContext Buttons
  onOpenAssessments: () => void;
  onOpenGrades: () => void;
  isEducatorWorkspace: boolean;
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
  // isSaving is no longer used here visually, but kept in interface for compatibility if needed elsewhere
  isSaving = false,
  onMenuToggle,
  onDiscuss,
  onStartLesson,
  onStartReview,
  onBookmark,
  onShare,
  onOpenCalendar,
  onUpgrade,
  onOpenAssessments,
  onOpenGrades,
  isEducatorWorkspace,
}) => {
  /* ──────────────────────────────────────────────────────────────────────
   * 1) Context access and derived state (O(1) reads and computations)
   * ────────────────────────────────────────────────────────────────────── */
  const { activeConceptMapId, getLessonModule, updateConceptMapTitle } = useLessonModule();
  const { getVisibility } = useYDoc();
  const { isPanelExpanded, togglePanel } = useViewSwitch();
  const { getDirtyThreadTotal } = useComments();
  // Consume subscription status to gate the Upgrade button
  const { accountStatus, subscriptionUi } = useAccountStatus();
  const isEducator = accountStatus?.accountType === 'educator';

  // Consume calendar badge state
  const { hasUnseenUpdates, resetUnseenCount } = useCalendar();
  
const dirtyCount = getDirtyThreadTotal();


//  Compute an accessible aria-label for the Discuss button
const discussAriaLabel = React.useMemo(() => {
  // Step 1: Clamp large numbers to "99+"
  const labelCount = dirtyCount > 19 ? '19+' : String(dirtyCount);
  // Step 2: Build a concise, screen-reader friendly label
  return dirtyCount > 0 ? `Discuss, ${labelCount} new` : 'Discuss';
}, [dirtyCount]);


//  Compute an accessible aria-label for the Planner button
const plannerAriaLabel = React.useMemo(() => {
    return hasUnseenUpdates ? `Study Planner, new updates available` : 'Open Study Planner';
  }, [hasUnseenUpdates]);


const isFreemium = subscriptionUi?.effectiveTier === 'freemium';

const isSubscribed = useMemo(() => {
    return subscriptionUi?.phase === 'ACTIVE' || subscriptionUi?.phase === 'CANCEL_AT_PERIOD_END';
  }, [subscriptionUi]);

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

  // NEW: State for Mobile Overflow Menu
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        {/* ─────────────────────────────────────────────────────────────
          LEFT CLUSTER: Menu | Lessons | Uploads | Discuss |Study Planner | Upgrade
         ───────────────────────────────────────────────────────────── */}
        {/* 3.1 Menu toggle button */}
        <button
          onClick={handleMenuClick}
          className="btn btn--icon canvas-header__menu"
          title={isPanelExpanded ? 'Collapse menu' : 'Expand menu'}
          aria-label={isPanelExpanded ? 'Collapse menu' : 'Expand menu'}
        >
          {renderMenuIcon()}
        </button>

        {/* 3.2 Lessons / Uploads navigation (mode-aware) */}
        {/*  Added desktop-only-nav to hide dropdowns on mobile */}
        <nav className="ch-nav desktop-only-nav" aria-label="Header navigation">
          {/* Converged dropdowns with single source of truth */}
          <UnifiedLessonsDropdown mode={mode} /> 
          <UnifiedUploadsDropdown mode={mode} /> 

          {/* Integrated Educator-only cluster for Assessments and Grades */}
          { isEducatorWorkspace && (
            <>
              <button
                onClick={onOpenAssessments}
                className="ch-nav__trigger"
                title="Assessments"
              >
                <span>Assessments</span>
              </button>

              
                  <button
                onClick={onOpenGrades}
                className="ch-nav__trigger"
                title="View Grades"
              >
                <span>Grades</span>
              </button>
                             
            </>
          )}
        </nav>
        <div className="flex items-center gap-2 ml-2 border-l pl-2 border-gray-200">
             {/* 3. Discuss (Moved to Left) */}
            <button
                onClick={onDiscuss}
                className="btn btn--border btn--has-badge"
                title="Discuss"
                aria-label={discussAriaLabel}
            >
                <MessageCircle size={16} /> 
                <span className="hidden lg:inline ml-1">Discuss</span>
                {dirtyCount > 0 && (
                <span className="btn-badge btn-badge--amber" aria-hidden="true">
                    {dirtyCount > 19 ? '19+' : dirtyCount}
                </span>
                )}
            </button>

            {/* 4. Study Planner (Text + Icon + Custom Color) */}
            {/* Study Planner Button with Boolean Badge */}
            <button
                onClick={() => {
                    // Reset Boolean Flag on Click
                    resetUnseenCount();
                    if (onOpenCalendar) onOpenCalendar();
                }}
                className="btn btn--border btn--has-badge"
                title="Open Study Planner"
                aria-label={plannerAriaLabel}
            >
                <CalendarIcon size={16} />
                <span className="font-medium">Study Planner</span>
                 {hasUnseenUpdates && (
                    <span className="btn-badge btn-badge--amber" aria-hidden="true">
                        1+
                    </span>
                )}
            </button>
        </div>

      </div>

      {/* RIGHT CLUSTER UPDATE: 
          1. Mandatory Items (Lesson, Review) are always rendered.
          2. Secondary Items ( Bookmark, Share) are hidden on mobile via CSS classes.
          3. "More" Menu appears on mobile to house Secondary Items.
      */}

      {/* ─────────────────────────────────────────────────────────────
          RIGHT CLUSTER: Start Lesson | Review | Bookmarks | Share
         ───────────────────────────────────────────────────────────── */}

      {/* Right cluster: action buttons */}
      <div className="flex items-center gap-2 right-cluster-actions">
        
        {/* Start Lesson */}
        <button
          onClick={onStartLesson}
          className="btn btn--primary btn-force-text"
        >
          <Play size={16} /> 
          <span className="btn-label">Start Lesson</span>
        </button>

        {/* Start Review */}
        {/* update - 10: Removed btn-force-text and added mobile-hidden-btn to hide on mobile */}
        <button
          onClick={onStartReview}
          className="btn btn--success mobile-hidden-btn"
        >
          <CheckCircle2 size={16} /> 
          <span className="btn-label">Start Review</span>
        </button>

        {/* Secondary Actions (Desktop) */}
        <div className="desktop-only-actions flex items-center gap-2">
          <button
            onClick={onBookmark}
            className="btn btn--icon btn--border"
            title="Bookmarks"
          >
            <Bookmark size={16} />
          </button>

          <button
            onClick={onShare}
            className="btn btn--icon btn--border"
            title="Share"
          >
            <Share2 size={16} />
          </button>
        </div>

        {/* Mobile Overflow */}
        <div className="mobile-overflow-container" ref={mobileMenuRef}>
          <button 
            className="btn btn--icon btn--border mobile-more-trigger"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <MoreVertical size={18} />
          </button>

          {isMobileMenuOpen && (
            <div className="mobile-dropdown-menu">
               {/* update - 11: Added Start Review and Upgrade to mobile menu */}
               <button onClick={() => { onStartReview(); setIsMobileMenuOpen(false); }} className="mobile-menu-item">
                 <CheckCircle2 size={16} /> Start Review
               </button>
              
              {isEducatorWorkspace && (
                 <>
                   <button onClick={() => { onOpenAssessments(); setIsMobileMenuOpen(false); }} className="mobile-menu-item">
                     <span/> Assessments
                   </button>

                   {/* UPDATE - 1.3: Apply the same Educator-only gate to the mobile menu item. */}
                   {isEducator && (
                     <button onClick={() => { onOpenGrades(); setIsMobileMenuOpen(false); }} className="mobile-menu-item">
                       <span/> Grades
                     </button>
                   )}
                 </>
               )}

               <button onClick={() => { onUpgrade && onUpgrade(); setIsMobileMenuOpen(false); }} className="mobile-menu-item">
                 <Zap size={16} /> Upgrade
               </button>

               <div className="border-t border-gray-200 my-1"></div>

               {/* Mobile duplicates of hidden items */}
               <button onClick={() => { onBookmark(); setIsMobileMenuOpen(false); }} className="mobile-menu-item">
                 <Bookmark size={16} /> Bookmarks
               </button>
               <button onClick={() => { onShare(); setIsMobileMenuOpen(false); }} className="mobile-menu-item">
                 <Share2 size={16} /> Share
               </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};

export default CanvasHeader;