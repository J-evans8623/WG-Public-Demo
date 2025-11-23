// app/studygraph/(studygraph)/components/layout/Canvas/toolbar/BottomToolbar.tsx

/**
 * @file BottomToolbar.tsx
 * @description
 *   Renders the bottom-center toolbar for CanvasView, providing editing and viewing controls
 *   for both concept-map and PDF modes while preserving the app’s established visual language.
 *   The toolbar presents Zoom In/Out controls, Undo/Redo, and PDF page navigation when in
 *   PDF mode. In this phase, we add a user-initiated “Re-center map” control that calls the
 *   ZoomContext’s imperative API to scroll the concept map back to the bed/content midpoint,
 *   clamping the zoom down to the initial fit if the user has zoomed in too far. This is a
 *   surgical, DOM-free integration: the toolbar does not know about refs or scroll math—it
 *   simply requests re-centering via context. Accessibility is maintained through keyboard
 *   focusability, aria-labels, and a native title tooltip. Purposeful logs are included for
 *   future debugging and observability, limited to critical actions and state transitions.
 *
 *   Responsibilities:
 *   1) Present mode-aware controls (concept-map vs PDF) without altering existing CSS.
 *   2) Add a discoverable Re-center control that invokes ZoomContext.requestMapRecenter()
 *      with clampToInitialFit=true so zoom never upscales automatically.
 *   3) Preserve component-level performance (all handlers are O(1) and memoized where helpful).
 *   4) Emit concise, uniquely-coded console logs only at important checkpoints.
 */

import React, { useState, useCallback } from 'react';
import {
  ZoomInButton,
  ZoomOutButton,
  PrevPageButton,
  NextPageButton,
  PageInputField,
  JumpButton,
  UndoButton,
  RedoButton,
} from './ToolBarButtons';
import './CanvasToolbar.css';
import { setGetLayout } from '@/app/Library/Context/LayoutActions';
import { useLayoutContext } from '@/app/Library/Context/LayoutProvider';
import { useZoomContext } from '@/app/Library/Context/ZoomProvider'; // update - 1


export interface BottomToolbarProps {
  activeView: 'conceptMap' | 'pdf';
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** Undo/Redo props (only used in conceptMap mode) */
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  /** PDF props */
  pdfPageInfo?: { current: number; total: number };
  onPdfPrevPage?: () => void;
  onPdfNextPage?: () => void;
  onPdfGoToPage?: (page: number) => void;
}

const BottomToolbar: React.FC<BottomToolbarProps> = ({
  activeView,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  pdfPageInfo,
  onPdfPrevPage,
  onPdfNextPage,
  onPdfGoToPage,
}) => {
  const [inputPage, setInputPage] = useState<string>('');
  const { dispatch: layoutDispatch } = useLayoutContext();

  // ZoomContext imperative API (Phase 1)  // update - 3
  const { requestMapRecenter } = useZoomContext();

  /**
   * @function attemptJump
   * @description
   *   Validates and triggers a page jump in PDF mode. If the input is a valid integer and
   *   within bounds, it navigates to that page and clears the input field. Errors are not
   *   thrown here; invalid input simply results in a no-op for a smooth UX.
   */
  const attemptJump = useCallback(() => {
    if (!onPdfGoToPage || !pdfPageInfo) return;
    const n = Number(inputPage);
    if (Number.isInteger(n) && n >= 1 && n <= pdfPageInfo.total) {
      onPdfGoToPage(n);
    }
    setInputPage('');
  }, [inputPage, onPdfGoToPage, pdfPageInfo]);

  /**
   * @function handleUndo
   * @description
   *   Wraps the Undo action to maintain existing layout recalculation behavior. It triggers
   *   the upstream layout refresh flag after invoking the provided onUndo callback. This is
   *   intentionally O(1) and avoids extra state churn.
   */
  const handleUndo = useCallback(() => {
    onUndo?.();
    layoutDispatch(setGetLayout(true));
  }, [layoutDispatch, onUndo]);

  /**
   * @function handleRedo
   * @description
   *   Analogous to handleUndo, but for Redo. Maintains the layout refresh behavior after the
   *   redo operation completes. This mirrors the existing convention in the toolbar.
   */
  const handleRedo = useCallback(() => {
    onRedo?.();
    layoutDispatch(setGetLayout(true));
  }, [layoutDispatch, onRedo]);

  /**
   * @function handleRecenter
   * @description
   *   Invokes the ZoomContext’s imperative “requestMapRecenter” to scroll to the midpoint of
   *   the map area. The clampToInitialFit flag ensures we never increase zoom automatically;
   *   if the user is zoomed-in, we clamp down to the initial fit zoom. DOM math and scroll
   *   writes are owned by MapRenderer; this handler remains O(1) and DOM-agnostic.
   */
  const handleRecenter = useCallback(() => { // update - 4
    console.log('[BottomToolbar.tsx][7401] Recenter requested from toolbar');
    requestMapRecenter({ clampToInitialFit: true });
  }, [requestMapRecenter]);


  const ViewfinderIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Four L-shaped corners */}
    <path
      d="M3 9V4a1 1 0 011-1h5M16 3h5a1 1 0 011 1v5M21 15v5a1 1 0 01-1 1h-5M8 21H4a1 1 0 01-1-1v-5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Center circle */}
    <circle
      cx="12"
      cy="12"
      r="2"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
    />
  </svg>
);

  /**
   * @function RecenterInlineButton
   * @description
   *   Small inline control that visually matches the other icon buttons through shared
   *   toolbar containment and neutral HTML button styling. We avoid changing any CSS files.
   *   The tooltip documents the future keyboard shortcut without binding it yet.
   */
const RecenterInlineButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Re-center map"
    title="Re-center map (⌘/Ctrl+0)"
    className="px-2 py-1 rounded hover:bg-gray-100 active:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
  >
    <ViewfinderIcon className="w-4 h-4" />
  </button>
);

  return (
    <div className="bottom-controls">
      {activeView === 'conceptMap' ? (
        <>
          {/* Zoom Out */}
          <ZoomOutButton onClick={onZoomOut} disabled={zoomLevel <= 0.5} />

          {/* Zoom Level Display */}
          <div className="px-3 py-1 text-sm font-medium text-gray-700 min-w-12 text-center">
            {Math.round(zoomLevel * 100)}%
          </div>

          {/* Zoom In */}
          <ZoomInButton onClick={onZoomIn} disabled={zoomLevel >= 2.0} />

          {/* Divider */}
          <div className="w-px h-5 bg-gray-300 mx-1" />

          {/* Re-center (new) — clamps to initial fit if zoomed-in */} {/* update - 6 */}
          <RecenterInlineButton onClick={handleRecenter} />

          {/* Divider */}
          <div className="w-px h-5 bg-gray-300 mx-1" />

          {/* Undo / Redo */}
          <UndoButton onClick={handleUndo} disabled={!canUndo} />
          <RedoButton onClick={handleRedo} disabled={!canRedo} />
        </>
      ) : (
        <>
          {/* PDF: Page Nav */}
          {pdfPageInfo && (
            <div className="control-section">
              <PrevPageButton
                onClick={onPdfPrevPage!}
                disabled={pdfPageInfo.current <= 1}
              />
              <div className="control-display">
                {pdfPageInfo.current} / {pdfPageInfo.total}
              </div>
              <NextPageButton
                onClick={onPdfNextPage!}
                disabled={pdfPageInfo.current >= pdfPageInfo.total}
              />
            </div>
          )}

          <div className="section-divider" />

          {/* PDF: Jump */}
          {pdfPageInfo && (
            <div className="control-section">
              <PageInputField
                currentValue={inputPage}
                min={1}
                max={pdfPageInfo.total}
                onChange={setInputPage}
                onEnter={attemptJump}
                placeholder="Page"
              />
              <JumpButton
                onClick={attemptJump}
                disabled={
                  !inputPage ||
                  Number(inputPage) < 1 ||
                  Number(inputPage) > (pdfPageInfo?.total ?? 0)
                }
              />
            </div>
          )}

          <div className="section-divider" />

          {/* PDF: Zoom */}
          <div className="zoom-controls">
            <ZoomOutButton onClick={onZoomOut} disabled={zoomLevel <= 0.5} />
            <div className="control-display">
              {Math.round(zoomLevel * 100)}%
            </div>
            <ZoomInButton onClick={onZoomIn} disabled={zoomLevel >= 2.0} />
          </div>
        </>
      )}
    </div>
  );
};

export default BottomToolbar;
