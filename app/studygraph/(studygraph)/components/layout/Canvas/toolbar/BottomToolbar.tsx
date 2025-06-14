/**
 * @file BottomToolbar.tsx
 * @description
 *   Renders the bottom-center toolbar for CanvasView, containing:
 *     • Zoom controls in Concept-Map mode (ZoomOut, zoom percentage display, ZoomIn)
 *     • PDF controls in PDF mode:
 *         1. Page navigation (PrevPageButton, “current / total”, NextPageButton)
 *         2. Jump-to-page (PageInputField + JumpButton)
 *         3. Zoom controls (ZoomOutButton, zoom percentage display, ZoomInButton)
 *
 *   Responsibilities:
 *     – Determine which control sections to render based on `activeView`.
 *     – Manage local state for the page-input field (`inputPage`) and handle jumps.
 *     – Wire all callbacks (`onZoomIn`, `onZoomOut`, `onPdfPrevPage`, `onPdfNextPage`, `onPdfGoToPage`).
 *     – Apply shared CSS classes from `ToolbarButton.css` and `CanvasToolbar.css` for consistent styling.
 *     – Ensure disabled logic for buttons (e.g., PrevPage when on page 1, ZoomOut at minimum).
 *     – Provide focus outlines on interactive elements for accessibility.
 */

import React, { useState, useCallback } from 'react';
import {
  ZoomInButton,
  ZoomOutButton,
  PrevPageButton,
  NextPageButton,
  PageInputField,
  JumpButton,
} from './ToolBarButtons';
import './CanvasToolbar.css';

export interface BottomToolbarProps {
  /** Which view is currently active: 'conceptMap' or 'pdf' */
  activeView: 'conceptMap' | 'pdf';

  /** Current zoom level (e.g., 1.0 means 100%) */
  zoomLevel: number;

  /** Callback to zoom in */
  onZoomIn: () => void;

  /** Callback to zoom out */
  onZoomOut: () => void;

  /**
   * PDF page information, only defined when activeView === 'pdf'.
   * - current: current page number (1-based)
   * - total: total number of pages
   */
  pdfPageInfo?: { current: number; total: number };

  /** Callback to go to previous PDF page (only in PDF mode) */
  onPdfPrevPage?: () => void;

  /** Callback to go to next PDF page (only in PDF mode) */
  onPdfNextPage?: () => void;

  /**
   * Callback to jump to a specific PDF page.
   * Receives the page number (1-based).
   * Only invoked when `activeView === 'pdf'`.
   */
  onPdfGoToPage?: (page: number) => void;
}

const BottomToolbar: React.FC<BottomToolbarProps> = ({
  activeView,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  pdfPageInfo,
  onPdfPrevPage,
  onPdfNextPage,
  onPdfGoToPage,
}) => {
  // Local state for the jump-to-page input (a string, since user types freely)
  const [inputPage, setInputPage] = useState<string>('');

  /**
   * attemptJump
   *   Parses `inputPage` as a number, validates it (between 1 and total pages),
   *   invokes onPdfGoToPage if valid, and then clears the input.
   */
  const attemptJump = useCallback(() => {
    if (!onPdfGoToPage || !pdfPageInfo) return;
    const n = Number(inputPage);
    if (
      Number.isInteger(n) &&
      n >= 1 &&
      n <= pdfPageInfo.total
    ) {
      onPdfGoToPage(n);
    }
    // Clear the field whether jump occurred or not
    setInputPage('');
  }, [inputPage, onPdfGoToPage, pdfPageInfo]);

  return (
    <div className="bottom-controls">
      {activeView === 'conceptMap' ? (
        // Concept-Map mode: only zoom controls
        <div className="zoom-controls">
          <ZoomOutButton
            onClick={onZoomOut}
            disabled={zoomLevel <= 0.5}
          />
          <div className="control-display">
            {Math.round(zoomLevel * 100)}%
          </div>
          <ZoomInButton
            onClick={onZoomIn}
            disabled={zoomLevel >= 2.0}
          />
        </div>
      ) : (
        // PDF mode: page navigation + jump + zoom controls
        <>
          {/* 1. Page Navigation Section */}
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

          {/* 2. Jump-to-Page Section */}
          {pdfPageInfo && (
            <div className="control-section">
              <PageInputField
                currentValue={inputPage}
                min={1}
                max={pdfPageInfo.total}
                onChange={(val) => setInputPage(val)}
                onEnter={attemptJump}
                placeholder="Page"
              />
              <JumpButton
                onClick={attemptJump}
                disabled={
                  !inputPage ||
                  Number(inputPage) < 1 ||
                  Number(inputPage) > pdfPageInfo.total
                }
              />
            </div>
          )}

          <div className="section-divider" />

          {/* 3. Zoom Controls Section */}
          <div className="zoom-controls">
            <ZoomOutButton
              onClick={onZoomOut}
              disabled={zoomLevel <= 0.5}
            />
            <div className="control-display">
              {Math.round(zoomLevel * 100)}%
            </div>
            <ZoomInButton
              onClick={onZoomIn}
              disabled={zoomLevel >= 2.0}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default BottomToolbar;
