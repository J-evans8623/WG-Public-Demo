// src/app/studygraph/(studygraph)/components/layout/CardDisplay/Cards/OverlayBehaviors.ts
/**
 * @file OverlayBehaviors.ts
 * @description
 * This utility module centralizes slideshow overlay, keyboard, and field-interaction mechanics used by the
 * unified SlideShowOverlay across both read-only and read/write modes. Its primary responsibilities are:
 * (1) provide a safe, composable keyboard handler that respects transient UI states (AI ask panel open,
 *     slide-number inline editing, in-progress edits) and avoids conflicting shortcuts;
 * (2) encapsulate “jump-to-slide” parsing and clamping logic to keep SlideShowOverlay’s JSX lean and declarative;
 * (3) expose a tiny focus management helper for the slide-number input to ensure screen-reader parity and predictable
 *     focus restoration; and (4) offer a simple “auto-advance on AI completion” observer that consumers can wire to
 *     their local loading flags. The functions in this module are pure, side-effect free (except for optional focus),
 *     and are designed for O(1) runtime per call. Console logs are sparse but intentional, tagged with file name and
 *     4-digit codes to provide high-signal breadcrumbs during production triage without adding log noise.
 * 
 * Responsibilities:
 *  1) Validate and clamp jump-to-slide index from a string input with graceful fallbacks.
 *  2) Produce a guarded keydown handler that is disabled during temporary input states.
 *  3) Manage focus for the slide-number input when toggling edit mode on/off.
 *  4) Provide a small observer helper for “AI finished” → next-slide auto-advance.
 */

export type NavFns = {
  gotoNext: () => void;
  gotoPrev: () => void;
  close: () => void;
};

export function parseJumpToIndex(
  raw: string,
  total: number
): number | null {
  // [OverlayBehaviors.ts][7101] jump-parse
  if (!/^\d+$/.test(raw)) return null;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return null;
  if (n < 1 || n > total) return null;
  return n - 1; // zero-based
}

export function makeKeydownHandler(opts: {
  disabled: boolean;
  nav: NavFns;
  isCueCard: boolean;
  flipCue: () => void;
}): (e: KeyboardEvent) => void {
  const { disabled, nav, isCueCard, flipCue } = opts;
  return (e: KeyboardEvent) => {
    if (disabled) return;
    // [OverlayBehaviors.ts][7102] keydown
    if (e.key === 'ArrowRight') {
      nav.gotoNext();
    } else if (e.key === 'ArrowLeft') {
      nav.gotoPrev();
    } else if (e.key === 'Escape') {
      nav.close();
    } else if (isCueCard && (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar')) {
      e.preventDefault();
      flipCue();
    }
  };
}

export function focusInput(el: HTMLInputElement | null) {
  if (!el) return;
  try {
    el.focus();
    el.select();
    // [OverlayBehaviors.ts][7103] focus slide-number
  } catch {
    // no-op
  }
}

export function autoAdvanceOnAskCompletion(prevLoading: boolean, nextLoading: boolean, askOpen: boolean, gotoNext: () => void) {
  // [OverlayBehaviors.ts][7104] ask-complete observer
  if (prevLoading && !nextLoading && !askOpen) {
    gotoNext();
  }
}
