// BottomToolbar.tsx

/**
 * @file BottomToolbar.tsx
 * @description
 *   Renders the bottom-center toolbar for CanvasView.
 *   • In Concept‑Map mode: Zoom controls + Undo/Redo, styled per the V2 prototype.
 *   • In PDF mode: Page navigation + jump + zoom controls (unchanged).
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

  const attemptJump = useCallback(() => {
    if (!onPdfGoToPage || !pdfPageInfo) return;
    const n = Number(inputPage);
    if (Number.isInteger(n) && n >= 1 && n <= pdfPageInfo.total) {
      onPdfGoToPage(n);
    }
    setInputPage('');
  }, [inputPage, onPdfGoToPage, pdfPageInfo]);

  const handleUndo = useCallback(()=>{
    onUndo!()
     layoutDispatch(setGetLayout(true));
  },[layoutDispatch, onUndo])

  const handleRedo = useCallback(()=>{
      onRedo!()
       layoutDispatch(setGetLayout(true));
  }, [layoutDispatch, onRedo])

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
                  Number(inputPage) > pdfPageInfo.total
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
