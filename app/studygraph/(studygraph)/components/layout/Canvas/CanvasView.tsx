
/**
 * @file CanvasView.tsx
 * @description
 *   Renders both Concept Map and PDF viewers simultaneously, hiding the inactive one via CSS.
 *   Preserves each view’s scroll and state by keeping both mounted.
 *
 * Responsibilities:
 *   - Always-mount both MapRenderer and PDFRenderer panels.
 *   - Toggle visibility using CSS classes (view-panel, hidden).
 *   - Provide isolated scroll contexts: map-panel (overflow hidden) and pdf-panel (overflow-y auto).
 *   - Maintain floating toolbar and status bar.
 *   - Remove external viewportRef prop; each viewer manages its own scrolling.
 *
 * CSS File (CanvasView.css) Responsibilities:
 *   - .view-panel: absolute positioning to fill parent container.
 *   - .hidden: hide inactive panels (display none).
 *   - .pdf-panel: enable vertical scrolling (overflow-y: auto).
 *   - .map-panel: hide overflow to preserve pan/zoom state.
 */

import React, { useCallback, useRef, useState } from 'react';
import MapRenderer from './MapRenderer';
import PDFRenderer from './PDFRenderer';
import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { ZoomActionType } from '@/app/Library/Definitions/Definitions';
import StatusBar from './StatusBar';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useViewSwitch } from '@/app/Library/Context/ViewSwitchContext';
import { CanvasToolbar } from './CanvasToolBar';
import type { PdfViewerRefType } from './PdfViewer';

import './CanvasView.css';

interface CanvasViewProps {
  isResourcePanelVisible: boolean;
  onToggleResourcePanel: () => void;
  autosaveStatus: 'saving' | 'saved';
}

export const CanvasView: React.FC<CanvasViewProps> = ({
  isResourcePanelVisible,
  onToggleResourcePanel,
  autosaveStatus,
}) => {
  const { dispatch: zoomDispatch } = useZoomContext();
  const { activeConceptMapId, getLessonModule } = useLessonModule();
  const { activeView, selectedPdfUrl } = useViewSwitch();

  // Determine lesson title
  const lessonModule = getLessonModule();
  const activeLesson = lessonModule.conceptMaps.find((cm) => cm.id === activeConceptMapId);
  const lessonTitle = activeLesson?.title || 'Untitled Lesson';

  // PDF scale
  const [pdfScale, setPdfScale] = useState(1.0);
  const handleZoomIn = useCallback(() => {
    if (activeView === 'conceptMap') {
      zoomDispatch({ type: ZoomActionType.ZOOM_IN });
    } else {
      setPdfScale((s) => s + 0.1);
    }
  }, [activeView, zoomDispatch]);

  const handleZoomOut = useCallback(() => {
    if (activeView === 'conceptMap') {
      zoomDispatch({ type: ZoomActionType.ZOOM_OUT });
    } else {
      setPdfScale((s) => Math.max(0.1, s - 0.1));
    }
  }, [activeView, zoomDispatch]);

  // PDF viewer ref and navigation
  const pdfRef = useRef<PdfViewerRefType>(null);
  const handlePdfPrev = () => pdfRef.current?.handlePrev();
  const handlePdfNext = () => pdfRef.current?.handleNext();

  // PDF page info state
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const handlePageChange = useCallback((current: number, total: number) => {
    setPdfCurrentPage(current);
    setPdfTotalPages(total);
  }, []);

  // Quick-jump
  const handlePdfGoToPage = (page: number) => {
    pdfRef.current?.handleGoTo(page);
  };

  return (
    <div className="flex-1 flex flex-col map-canvas map-border rounded-md relative">
      {/* Lesson title when in map view */}
      {activeView === 'conceptMap' && (
        <div className="sticky top-0 left-0 z-20 mt-4 ml-12 inline-block px-6 py-1 bg-white text-base font-semibold rounded">
          {autosaveStatus === 'saving' ? 'Saving...' : lessonTitle}
        </div>
      )}

      {/* Status bar (shared) */}
      <StatusBar />

      {/* Panels container */}
      <div className="relative flex-1">
        {/* Concept Map Panel */}
        <div className={`view-panel map-panel ${activeView !== 'conceptMap' ? 'hidden' : ''}`}>
          <MapRenderer />
        </div>

        {/* PDF Panel */}
        <div className={`view-panel pdf-panel ${activeView !== 'pdf' ? 'hidden' : ''}`}>  
          <PDFRenderer
            ref={pdfRef}
            fileUrl={selectedPdfUrl}
            scale={pdfScale}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {/* Floating toolbar */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center space-x-4 bg-gray-100 rounded-full shadow-md px-4 py-2">
        <CanvasToolbar
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          activeView={activeView}
          onPdfPrevPage={handlePdfPrev}
          onPdfNextPage={handlePdfNext}
          pdfPageInfo={{ current: pdfCurrentPage, total: pdfTotalPages }}
          onPdfGoToPage={handlePdfGoToPage}
        />
      </div>
    </div>
  );
};

export default CanvasView;
