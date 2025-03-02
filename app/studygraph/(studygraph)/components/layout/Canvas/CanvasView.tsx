/**
 * @file CanvasView.tsx
 * @description
 *   This component renders the main canvas view. It displays either a Concept Map or Uploads 
 *   (processed PDFs) based on the active view. It also provides a bottom toolbar for navigation 
 *   and zoom control.
 *
 *   Responsibilities:
 *     - Render the resource panel along with the main content area.
 *     - Switch between Concept Map and Uploads tabs.
 *     - Automatically reflect the user's selection from the resource panel.
 *
 *   Update:
 *     - The "Notes" tab has been renamed to "Uploads" for clarity.
 *
 * @author  
 * @date    
 */

import React, { useCallback, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MapRenderer from './MapRenderer';
import { PDFRenderer } from './PDFRenderer';
import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { ZoomActionType } from '@/app/Library/Definitions/Definitions';
import StatusBar from './StatusBar';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useViewSwitch } from '@/app/Library/Context/ViewSwitchContext';
import { CanvasToolbar } from './CanvasToolBar';
import '@/app/studygraph/(studygraph)/components/layout/mapTheme.css';
import '@/app/studygraph/(studygraph)/components/layout/scrollbar.css';

interface CanvasViewProps {
  isResourcePanelVisible: boolean;
  onToggleResourcePanel: () => void;
  viewportRef: React.RefObject<HTMLDivElement>;
  autosaveStatus: 'saving' | 'saved';
}

export type PdfViewerRefType = {
  handlePrev: () => void;
  handleNext: () => void;
};

export const CanvasView: React.FC<CanvasViewProps> = ({
  isResourcePanelVisible,
  onToggleResourcePanel,
  viewportRef,
  autosaveStatus,
}) => {
  const { dispatch: zoomDispatch } = useZoomContext();
  const { activeConceptMapId, getLessonModule } = useLessonModule();
  const { activeView, selectedPdfUrl, setActiveView } = useViewSwitch();

  const lessonModule = getLessonModule();
  const activeLesson = lessonModule.conceptMaps.find(
    (conceptMap) => conceptMap.id === activeConceptMapId
  );
  const lessonTitle = activeLesson ? activeLesson.title : 'Untitled Lesson';

  const [pdfScale, setPdfScale] = useState<number>(1.0);

  const handleZoomIn = useCallback(() => {
    if (activeView === 'conceptMap') {
      zoomDispatch({ type: ZoomActionType.ZOOM_IN });
    } else {
      setPdfScale((prev) => prev + 0.1);
    }
  }, [activeView, zoomDispatch]);

  const handleZoomOut = useCallback(() => {
    if (activeView === 'conceptMap') {
      zoomDispatch({ type: ZoomActionType.ZOOM_OUT });
    } else {
      setPdfScale((prev) => Math.max(0.1, prev - 0.1));
    }
  }, [activeView, zoomDispatch]);

  const pdfViewerRef = useRef<PdfViewerRefType | null>(null);

  const handlePdfPrevPage = useCallback(() => {
    pdfViewerRef.current?.handlePrev();
  }, []);

  const handlePdfNextPage = useCallback(() => {
    pdfViewerRef.current?.handleNext();
  }, []);

  const [pdfCurrentPage, setPdfCurrentPage] = useState<number>(0);
  const [pdfTotalPages, setPdfTotalPages] = useState<number>(0);

  const handlePageChange = useCallback((current: number, total: number) => {
    setPdfCurrentPage(current);
    setPdfTotalPages(total);
  }, []);

  return (
    <div className="flex-1 flex flex-col map-canvas map-border rounded-md relative">
      {/* Arrow button to show/hide resource panel */}
      <button
        onClick={onToggleResourcePanel}
        className="absolute left-2 top-1/2 -translate-y-1/2 z-30 bg-white border border-gray-200 rounded shadow p-2 hover:bg-gray-50 transition-colors"
      >
        {isResourcePanelVisible ? (
          <ChevronLeft className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {/* Main content area */}
      <div
        ref={viewportRef}
        className="flex-1 min-h-0 relative custom-scrollbar overflow-y-scroll"
        data-testid="canvas-view"
      >
        {activeView === 'conceptMap' && (
          <div className="sticky top-0 left-0 z-20 m-4 inline-block px-3 py-1 bg-white text-lg font-semibold rounded">
            {autosaveStatus === 'saving' ? 'Saving...' : lessonTitle}
          </div>
        )}

        <StatusBar />

        {activeView === 'conceptMap' ? (
          <MapRenderer viewportRef={viewportRef} />
        ) : (
          <PDFRenderer
            fileUrl={selectedPdfUrl}
            pdfViewerRef={pdfViewerRef}
            onPageChange={handlePageChange}
            scale={pdfScale}
          />
        )}
      </div>

      {/* Bottom Bar */}
      <div className="bottom-bar">
        <div>
          <button
            className={`px-4 py-2 text-sm ${
              activeView === 'conceptMap'
                ? 'border-b-2 border-blue-600 font-semibold'
                : 'text-gray-500'
            }`}
            onClick={() => setActiveView('conceptMap')}
          >
            Concept Map
          </button>
          <button
            className={`px-4 py-2 text-sm ml-4 ${
              activeView === 'pdf'
                ? 'border-b-2 border-blue-600 font-semibold'
                : 'text-gray-500'
            }`}
            onClick={() => setActiveView('pdf')}
          >
            Uploads
          </button>
        </div>
        <CanvasToolbar
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          activeView={activeView}
          onPdfPrevPage={handlePdfPrevPage}
          onPdfNextPage={handlePdfNextPage}
          pdfPageInfo={{ current: pdfCurrentPage, total: pdfTotalPages }}
        />
      </div>
    </div>
  );
};

export default CanvasView;
