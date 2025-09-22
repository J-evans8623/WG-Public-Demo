/**
 * @file QuizExitWarningModal.tsx
 * @description
 * A self-contained, accessible confirmation modal used by the quiz overlay to warn users
 * before exiting or submitting early. This version supports rendering into its own portal
 * (recommended) via `containerId`, adds ESC-to-close, and a minimal focus trap so keyboard
 * navigation stays within the dialog while open. Backdrop clicks close only when the user
 * actually clicks the backdrop (target===currentTarget).
 *
 * NOTE: Body scroll locking and page `inert` toggling should be handled by the parent modal /
 * modal manager so that multi-layer stacks (quiz -> confirm) don’t prematurely unlock scroll.
 *
 * Props:
 * - open: boolean – controls visibility.
 * - title: string – heading text.
 * - message: string – body text (kept generic by product decision).
 * - confirmLabel: string – primary action label.
 * - cancelLabel?: string – secondary action label (default: “Keep working”).
 * - onCancel: () => void – invoked when user cancels.
 * - onConfirm: () => void – invoked when user confirms.
 * - containerId?: string – OPTIONAL portal container id (e.g., "confirm-modal-root").
 *   If provided and found, the dialog renders into that DOM node via createPortal.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react'; // update - 1
import { createPortal } from 'react-dom'; // update - 2

export interface QuizExitWarningModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  containerId?: string; // update - 3
}

const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'; // update - 4

const QuizExitWarningModal: React.FC<QuizExitWarningModalProps> = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Keep working',
  onCancel,
  onConfirm,
  containerId, // update - 5
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null); // update - 6

  // update - 7
  // Focus on the cancel button by default (fast keyboard dismissal)
  useEffect(() => {
    if (open && cancelBtnRef.current) {
      cancelBtnRef.current.focus();
    }
  }, [open]);

  // update - 8
  // ESC to close (only while open)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  // update - 9
  // Minimal focus trap: keep Tab navigation inside the dialog
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const root = dialogRef.current;
    if (!root) return;

    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);

    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (e.shiftKey) {
      if (active === first || !root.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !root.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  if (!open) return null;

  // update - 10
  // Backdrop click should only fire when the backdrop itself is clicked
  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onCancel();
  };

  // update - 11
  // Render the dialog content
  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-exit-warning-title"
      aria-describedby="quiz-exit-warning-desc"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2300,
      }}
      onMouseDown={onBackdropClick}
      onKeyDown={onKeyDown}
    >
      <div
        ref={dialogRef}
        style={{
          background: '#fff',
          width: 'min(520px, 92vw)',
          borderRadius: '10px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
          overflow: 'hidden',
          outline: 'none',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <h3 id="quiz-exit-warning-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
            {title}
          </h3>
        </div>
        <div id="quiz-exit-warning-desc" style={{ padding: '16px 20px', color: '#374151', lineHeight: 1.5 }}>
          <p style={{ margin: 0 }}>{message}</p>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            padding: '14px 20px',
            background: '#f9fafb',
            borderTop: '1px solid #e5e7eb',
          }}
        >
          <button ref={cancelBtnRef} onClick={onCancel} className="quiz-btn quiz-btn-secondary">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className="quiz-btn quiz-btn-primary">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  // update - 12
  // If a containerId is given and exists, render via a dedicated portal (recommended).
  const portalEl = containerId ? document.getElementById(containerId) : null 


  return portalEl ? createPortal(content, portalEl) : content; // update - 13
};

export default QuizExitWarningModal;
