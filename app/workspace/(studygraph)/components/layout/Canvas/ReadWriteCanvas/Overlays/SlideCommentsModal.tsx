/**
 * @file SlideCommentsModal.tsx
 * @description
 * This file implements the dedicated comment manager modal for the Slide Comment System. Its responsibility
 * is to provide a single, cohesive interaction surface for viewing, creating, editing, and deleting comments
 * associated with the currently active slide in the slideshow experience. The modal intentionally consumes the
 * SlideCommentsContext directly instead of making its own fetch calls or maintaining duplicate persistence
 * state. That design keeps all optimistic behavior, rollback handling, and document-scoped caching inside the
 * shared context layer while allowing this modal to remain focused on presentation and interaction flow.
 *
 * The component is designed to fit into the existing WiseGraph slideshow visual system without requiring broad
 * CSS refactors. It uses the same portal strategy and light academic aesthetic already present in the overlay,
 * while introducing a narrow internal layout for the comment list, inline edit affordances, and bottom composer.
 * The modal is intentionally self-contained so SlideShowOverlay.tsx can mount it with a small, readable API.
 *
 * Design revision: Scrollable-thread layout (Design D).
 * - Modal repositioned to top-right to act as a subordinate panel, preserving the parent slideshow as the
 *   dominant visual anchor rather than covering it with a centred overlay.
 * - Comment list is constrained to a fixed max-height and scrolls internally so the popover never grows
 *   beyond the viewport regardless of comment count or length.
 * - Long comment bodies (> CLAMP_THRESHOLD chars) are clamped to three lines with a "Read more" toggle so
 *   dense annotations do not force the panel to grow.
 * - A live character counter in the composer gives users awareness of annotation length without a hard cap.
 * - All CRUD operations, optimistic state, and rollback behaviour remain entirely unchanged — only the
 *   presentational layer has been updated.
 */

import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { MessageSquare, Pencil, Trash2, X } from 'lucide-react';
import { useSlideComments } from '@/app/Library/Context/SlideCommentsContext';
import type { ResourceCard, SlideCommentRecord } from '@/app/Library/Definitions/Definitions';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useAccountStatus } from '@/app/src/context/ApiContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SlideCommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSlide: ResourceCard | null;
  currentLessonTitle: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Comment body character length above which the text is clamped to three lines
 * and a "Read more" affordance is shown. Keeps the scrollable list compact for
 * longer annotations while ensuring full text remains accessible.
 */
const CLAMP_THRESHOLD = 200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * @function formatRelativeCommentTime
 * @description
 * Formats a comment timestamp into a lightweight human-readable relative label so the modal can convey
 * freshness without introducing a heavy date formatting dependency. The function intentionally favors a
 * compact output such as "Just now", "5 minutes ago", or a local date string for older entries.
 */
function formatRelativeCommentTime(timestamp: string): string {
  const parsed = new Date(timestamp);
  const diffMs = Date.now() - parsed.getTime();

  if (!Number.isFinite(diffMs) || Number.isNaN(diffMs)) {
    return '';
  }

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return 'Just now';
  if (diffMs < hour) return `${Math.floor(diffMs / minute)} minute${Math.floor(diffMs / minute) === 1 ? '' : 's'} ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)} hour${Math.floor(diffMs / hour) === 1 ? '' : 's'} ago`;
  if (diffMs < day * 2) return 'Yesterday';

  return parsed.toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * @function SlideCommentsModal
 * @description
 * Renders the active slide's comment manager in a portal-backed modal. The component reads the current
 * slide's comment list from SlideCommentsContext, supports inline edit/delete actions, and exposes a bottom
 * composer for optimistic comment creation. All mutations flow through the context so network and rollback
 * behaviour remain centralised in Phase 3's data layer.
 *
 * Visual hierarchy: the panel is anchored to the top-right of the viewport so it sits beside the parent
 * slideshow overlay rather than covering it. The comment list scrolls internally via a max-height container,
 * and long bodies are togglable via a "Read more" control.
 */
const SlideCommentsModal: React.FC<SlideCommentsModalProps> = ({
  isOpen,
  onClose,
  currentSlide,
  currentLessonTitle,
}) => {
  // -------------------------------------------------------------------------
  // Context
  // -------------------------------------------------------------------------

  const {
    getCommentsForSlide,
    createComment,
    updateComment,
    deleteComment,
    error,
  } = useSlideComments();

  const { docFileID } = useYDoc();
  const { accountStatus } = useAccountStatus();
  const email = accountStatus?.email;

  // -------------------------------------------------------------------------
  // State — all original fields preserved; expandedIds is the only addition
  // -------------------------------------------------------------------------

  const [draftText, setDraftText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  /**
   * Tracks which comment IDs have been manually expanded past the three-line clamp.
   * Lives entirely in presentation layer — no effect on data or context.
   */
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------

  const slideComments = useMemo<SlideCommentRecord[]>(() => {
    if (!currentSlide) return [];
    return getCommentsForSlide(currentSlide.id);
  }, [currentSlide, getCommentsForSlide]);

  /** Live character count shown in the composer footer. */
  const charCount = draftText.length;

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!isOpen) {
      setDraftText('');
      setEditingCommentId(null);
      setEditingText('');
      setPendingDeleteId(null);
      setExpandedIds(new Set());
    }
  }, [isOpen]);

  // -------------------------------------------------------------------------
  // Early return guard (unchanged)
  // -------------------------------------------------------------------------

  if (!isOpen || !currentSlide) {
    return null;
  }

  // -------------------------------------------------------------------------
  // Handlers — all original implementations preserved verbatim
  // -------------------------------------------------------------------------

  /**
   * @function handleCreateComment
   * @description
   * Validates the composer input, then performs an optimistic create through SlideCommentsContext. The
   * modal clears the composer immediately on success while relying on the context to reconcile or roll
   * back the new record depending on the backend result.
   */
  const handleCreateComment = async (): Promise<void> => {
    const normalizedText = draftText.trim();

    if (!normalizedText || isSubmittingCreate) {
      return;
    }

    setIsSubmittingCreate(true);

    try {
      const created = await createComment({
        docId: docFileID!,
        lessonId: currentSlide.mapId,
        slideId: currentSlide.id,
        userId: email!,
        text: normalizedText,
      });

      if (created) {
        setDraftText('');
      }
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  /**
   * @function handleBeginEdit
   * @description
   * Enters inline edit mode for a specific comment row by seeding the local edit buffer with the current
   * comment text. This keeps edit interactions lightweight and tightly scoped to a single row.
   */
  const handleBeginEdit = (comment: SlideCommentRecord): void => {
    setEditingCommentId(comment.id);
    setEditingText(comment.text);
  };

  /**
   * @function handleCancelEdit
   * @description
   * Exits inline edit mode and clears the temporary edit buffer. This restores the row to display mode
   * without mutating the underlying optimistic comment state.
   */
  const handleCancelEdit = (): void => {
    setEditingCommentId(null);
    setEditingText('');
  };

  /**
   * @function handleSaveEdit
   * @description
   * Persists an edited comment by sending the updated text through SlideCommentsContext. The context
   * applies the optimistic update immediately and handles reconciliation or rollback in the background.
   */
  const handleSaveEdit = async (commentId: string): Promise<void> => {
    const normalizedText = editingText.trim();

    if (!normalizedText) {
      return;
    }

    const updated = await updateComment({
      commentId,
      text: normalizedText,
    });

    if (updated) {
      handleCancelEdit();
    }
  };

  /**
   * @function handleDeleteComment
   * @description
   * Performs an optimistic delete for the selected comment row while using a small local pending-delete
   * marker to prevent accidental rapid repeat clicks during the in-flight request window.
   */
  const handleDeleteComment = async (commentId: string): Promise<void> => {
    if (pendingDeleteId) {
      return;
    }

    setPendingDeleteId(commentId);

    try {
      await deleteComment({ commentId });
    } finally {
      setPendingDeleteId(null);
    }
  };

  /**
   * @function handleToggleExpand
   * @description
   * Toggles the expanded state for a single comment's body text. Only relevant when the comment body
   * exceeds CLAMP_THRESHOLD characters. Does not affect data layer.
   */
  const handleToggleExpand = (commentId: string): void => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return ReactDOM.createPortal(
    <>
      {/*
       * Backdrop: uses a lighter, more transparent scrim compared to the original so the parent
       * slideshow remains clearly legible behind the panel — reinforcing visual hierarchy.
       */}
      <div
        className="slideshow-backdrop"
        onClick={onClose}
        aria-hidden="true"
        style={{ background: 'rgba(20, 15, 10, 0.35)' }}
      />

      {/*
       * Dialog shell: repositioned from screen-centre to top-right so it reads as a subordinate
       * annotation panel rather than a competing primary surface. Width is intentionally narrower
       * than the original to leave the parent overlay visible on all sides.
       */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Slide comments"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(400px, calc(100vw - 24px))',
          maxWidth: '400px',
          maxHeight: 'min(600px, 85vh)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 1200,
          borderRadius: '16px',
          background: '#fcfbf8',
          border: '1px solid rgba(120, 94, 62, 0.16)',
          boxShadow: '0 8px 40px rgba(60, 40, 20, 0.18), 0 2px 8px rgba(60, 40, 20, 0.08)',
        }}
      >
        {/* ----------------------------------------------------------------
         * Header
         * ---------------------------------------------------------------- */}
        <header
          style={{
            padding: '16px 18px 14px 18px',
            borderBottom: '1px solid rgba(120, 94, 62, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fcfbf8',
            flexShrink: 0,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '0.95rem',
                fontWeight: 700,
                color: '#5f4630',
                letterSpacing: '0.01em',
              }}
            >
              Comments
            </h2>
            <p
              style={{
                margin: '3px 0 0 0',
                fontSize: '0.78rem',
                color: '#9b8a79',
                lineHeight: 1.3,
                maxWidth: '280px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {currentSlide.title || currentLessonTitle || 'Current slide'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close comments"
            style={{
              border: 'none',
              background: '#f0ebe2',
              cursor: 'pointer',
              color: '#8b6b47',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              flexShrink: 0,
            }}
          >
            <X size={15} />
          </button>
        </header>

        {/* ----------------------------------------------------------------
         * Comment list — scrollable, max-height constrained
         * The list owns its own scroll context so the composer always stays
         * pinned at the bottom regardless of comment count or length.
         * ---------------------------------------------------------------- */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            background: '#ffffff',
            // Subtle inset shadow at top/bottom edges to communicate scrollability
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(139, 107, 71, 0.25) transparent',
          }}
        >
          {slideComments.length === 0 ? (
            /* Empty state */
            <div
              style={{
                padding: '32px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                color: '#8a7a6a',
                gap: '10px',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: '#f5ede0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#b09070',
                }}
              >
                <MessageSquare size={22} />
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#6d5946' }}>
                No comments yet
              </div>
              <div style={{ fontSize: '0.8rem', maxWidth: '260px', color: '#9b8a79', lineHeight: 1.5 }}>
                Add a personal note, reminder, or insight.
              </div>
            </div>
          ) : (
            slideComments.map((comment) => {
              const isEditingRow = editingCommentId === comment.id;
              const isPendingDelete = pendingDeleteId === comment.id;
              const isLong = comment.text.length > CLAMP_THRESHOLD;
              const isExpanded = expandedIds.has(comment.id);

              return (
                <div
                  key={comment.id}
                  style={{
                    padding: '14px 18px',
                    borderBottom: '1px solid rgba(120, 94, 62, 0.08)',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    opacity: isPendingDelete ? 0.5 : 1,
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  {/* Comment icon — visual anchor for each row */}
                  <div
                    style={{
                      marginTop: '1px',
                      color: '#c0a882',
                      flexShrink: 0,
                    }}
                  >
                    <MessageSquare size={15} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditingRow ? (
                      /* --------------------------------------------------
                       * Inline edit mode — preserved from original
                       * -------------------------------------------------- */
                      <>
                        <textarea
                          value={editingText}
                          onChange={(event) => setEditingText(event.target.value)}
                          rows={4}
                          style={{
                            width: '100%',
                            resize: 'vertical',
                            border: '1px solid rgba(120, 94, 62, 0.22)',
                            borderRadius: '10px',
                            padding: '10px 12px',
                            fontSize: '0.88rem',
                            lineHeight: 1.5,
                            color: '#40342a',
                            outline: 'none',
                            fontFamily: 'inherit',
                            background: '#fffdfa',
                            boxSizing: 'border-box',
                          }}
                          autoFocus
                        />
                        <div
                          style={{
                            display: 'flex',
                            gap: '8px',
                            marginTop: '8px',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(comment.id)}
                            style={{
                              border: 'none',
                              borderRadius: '8px',
                              padding: '7px 14px',
                              background: '#8b6b47',
                              color: '#ffffff',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '0.82rem',
                            }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            style={{
                              border: '1px solid rgba(120, 94, 62, 0.18)',
                              borderRadius: '8px',
                              padding: '7px 14px',
                              background: 'transparent',
                              color: '#6f5a46',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '0.82rem',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      /* --------------------------------------------------
                       * Read mode — text clamp + expand toggle added
                       * -------------------------------------------------- */
                      <>
                        {/* Meta row: author label + timestamp */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginBottom: '5px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#8b6b47',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            You
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#b8a898' }}>·</span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              color: '#b8a898',
                            }}
                          >
                            {formatRelativeCommentTime(comment.updatedAt)}
                          </span>
                        </div>

                        {/* Comment body with optional three-line clamp */}
                        <div
                          style={{
                            fontSize: '0.88rem',
                            lineHeight: 1.6,
                            color: '#40342a',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            // Apply CSS line-clamp when long and not expanded
                            ...(isLong && !isExpanded
                              ? {
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical' as const,
                                  overflow: 'hidden',
                                }
                              : {}),
                          }}
                        >
                          {comment.text}
                        </div>

                        {/* "Read more / Show less" toggle — only shown for long comments */}
                        {isLong && (
                          <button
                            type="button"
                            onClick={() => handleToggleExpand(comment.id)}
                            style={{
                              border: 'none',
                              background: 'none',
                              padding: '2px 0',
                              marginTop: '4px',
                              fontSize: '0.75rem',
                              color: '#8b6b47',
                              cursor: 'pointer',
                              fontWeight: 600,
                              textDecoration: 'underline',
                              textUnderlineOffset: '2px',
                            }}
                          >
                            {isExpanded ? 'Show less ↑' : 'Read more ↓'}
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Edit / Delete action buttons — shown in read mode only, preserved from original */}
                  {!isEditingRow && (
                    <div
                      style={{
                        display: 'flex',
                        gap: '6px',
                        alignItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleBeginEdit(comment)}
                        aria-label="Edit comment"
                        style={{
                          border: 'none',
                          background: '#f5ede0',
                          color: '#8b6b47',
                          cursor: 'pointer',
                          borderRadius: '8px',
                          width: '30px',
                          height: '30px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(comment.id)}
                        aria-label="Delete comment"
                        disabled={isPendingDelete}
                        style={{
                          border: 'none',
                          background: '#f5ede0',
                          color: '#8b6b47',
                          cursor: isPendingDelete ? 'not-allowed' : 'pointer',
                          borderRadius: '8px',
                          width: '30px',
                          height: '30px',
                          opacity: isPendingDelete ? 0.45 : 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ----------------------------------------------------------------
         * Composer footer — pinned at bottom, scrolls with the panel not
         * the list. Character counter added for long-comment awareness.
         * ---------------------------------------------------------------- */}
        <footer
          style={{
            padding: '12px 18px 16px 18px',
            borderTop: '1px solid rgba(120, 94, 62, 0.10)',
            background: '#fcfbf8',
            flexShrink: 0,
          }}
        >
          {/* Error banner — preserved from original */}
          {error && (
            <div
              style={{
                marginBottom: '8px',
                fontSize: '0.8rem',
                color: '#a34b38',
                background: '#fdf0ed',
                border: '1px solid rgba(163, 75, 56, 0.2)',
                borderRadius: '8px',
                padding: '7px 10px',
              }}
            >
              {error}
            </div>
          )}

          <textarea
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            onKeyDown={(event) => {
              // Cmd/Ctrl + Enter submits without requiring the button click
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                void handleCreateComment();
              }
            }}
            placeholder="Add a comment for this slide…"
            rows={3}
            style={{
              width: '100%',
              resize: 'none',
              border: '1px solid rgba(120, 94, 62, 0.20)',
              borderRadius: '10px',
              padding: '10px 12px',
              fontSize: '0.88rem',
              lineHeight: 1.5,
              color: '#40342a',
              outline: 'none',
              fontFamily: 'inherit',
              background: '#fffdfa',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(139, 107, 71, 0.45)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(120, 94, 62, 0.20)';
            }}
          />

          {/* Bottom row: character counter (left) + submit button (right) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '8px',
            }}
          >
            <span
              style={{
                fontSize: '0.72rem',
                color: charCount > 0 ? '#b09070' : 'transparent',
                fontVariantNumeric: 'tabular-nums',
                userSelect: 'none',
              }}
              aria-live="polite"
            >
              {charCount} {charCount === 1 ? 'char' : 'chars'}
            </span>

            <button
              type="button"
              onClick={handleCreateComment}
              disabled={!draftText.trim() || isSubmittingCreate}
              style={{
                border: '1px solid rgba(139, 107, 71, 0.22)',
                borderRadius: '10px',
                padding: '8px 18px',
                background: draftText.trim() && !isSubmittingCreate ? '#8b6b47' : '#f0ebe2',
                color: draftText.trim() && !isSubmittingCreate ? '#ffffff' : '#b09070',
                cursor: !draftText.trim() || isSubmittingCreate ? 'not-allowed' : 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600,
                transition: 'background 0.15s ease, color 0.15s ease',
                opacity: isSubmittingCreate ? 0.7 : 1,
              }}
            >
              {isSubmittingCreate ? 'Posting…' : '+ Add Comment'}
            </button>
          </div>
        </footer>
      </div>
    </>,
    document.body
  );
};

export default SlideCommentsModal;