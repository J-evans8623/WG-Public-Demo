/**
 * @file CanvasView.tsx
 * @description
 *   Renders the canvas view containing either a concept-map or a PDF.
 *   Wraps the concept-map renderer in a div whose class equals the current theme.
 *
 *   Responsibilities:
 *     • Render TopToolbar and BottomToolbar.
 *     • Wrap <MapRenderer /> in a <div className={colorTheme}> so CSS can theme nodes.
 *     • Preserve existing zoom, pan, and other behaviors.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import MapRenderer from './MapRenderer';
import PDFRenderer from './PDFRenderer';
import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { ZoomActionType } from '@/app/Library/Definitions/Definitions';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useViewSwitch } from '@/app/Library/Context/ViewSwitchContext';
import { useUndoRedo } from '@/app/studygraph/(studygraph)/components/Context/UndoRedoContext';
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useSearchContext } from '@/app/Library/Context/SearchContext';
import TopToolbar from './toolbar/TopToolbar';
import BottomToolbar from './toolbar/BottomToolbar';
import QuizGeneratorModal from './QuizGeneratorModal';
import type { PdfViewerRefType } from './PdfViewer';

import { useSlideShow } from '@/app/Library/Context/SlideShowContext';
import { usePreorderTraversal } from '@/app/studygraph/(studygraph)/components/hooks/usePreorderTraversal';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import type { ResourceCard } from '@/app/Library/Definitions/Definitions';

import { useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';

import './CanvasView.css';

interface CanvasViewProps {
  isResourcePanelVisible: boolean; // reserved for future use
  autosaveStatus: 'saving' | 'saved';
}

export const CanvasView: React.FC<CanvasViewProps> = ({
  autosaveStatus,
}) => {
  /* ───────────────────────────── Context hooks ──────────────────────────── */
  const { dispatch: zoomDispatch, zoomLevel } = useZoomContext();
  const { activeConceptMapId, getLessonModule, updateConceptMapTitle } =
    useLessonModule();
  const { activeView, selectedPdfUrl } = useViewSwitch();
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const { multiSelectEnabled, toggleMultiSelectEnabled } = useNodeSelection();
  const { open: openSearchModal } = useSearchContext();
  const { openCustom } = useSlideShow();
  const preorder = usePreorderTraversal();
  const { getReviewNode, getNodeTitle } = useNodesContext();
  const { selectCueCards, selectPictures, selectPracticeSheets, selectNoteCards } = useResourceContext();
  const { colorTheme } = useColorThemeContext();

  /* ───────────────────────────── Lesson-title state ──────────────────────── */
  const lessonModule = getLessonModule();
  const activeLesson = lessonModule.conceptMaps.find(
    (cm) => cm.id === activeConceptMapId
  );
  const lessonTitle = activeLesson?.title || 'Untitled Lesson';

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(lessonTitle);

  useEffect(() => {
    if (!isEditingTitle) {
      setTitleDraft(lessonTitle);
    }
  }, [lessonTitle, isEditingTitle]);

  const commitTitleChange = useCallback(() => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== lessonTitle) {
      updateConceptMapTitle(activeConceptMapId, trimmed);
    }
    setIsEditingTitle(false);
  }, [titleDraft, lessonTitle, updateConceptMapTitle, activeConceptMapId]);

  /* ───────────────────────────── Zoom handlers ───────────────────────────── */
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

  /* ─────────────────────── PDF navigation helpers ───────────────────────── */
  const pdfRef = useRef<PdfViewerRefType>(null);
  const handlePdfPrev = () => pdfRef.current?.handlePrev();
  const handlePdfNext = () => pdfRef.current?.handleNext();

  const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);

  const handlePageChange = useCallback((current: number, total: number) => {
    setPdfCurrentPage(current);
    setPdfTotalPages(total);
  }, []);

  const handlePdfGoToPage = (page: number) => {
    pdfRef.current?.handleGoTo(page);
  };

  /* ─────────────────────────────── Title-bar styling ───────────────────────── */
  const isSaving = autosaveStatus === 'saving';
  const labelClasses = [
    'sticky',
    'top-0',
    'left-0',
    'z-20',
    'mt-4',
    'ml-16', // 64px offset to clear the hamburger icon
    'inline-block',
    'px-4',
    'py-1',
    'bg-white',
    'rounded',
    'max-w-[340px]',
    'truncate',
    isSaving || isEditingTitle ? '' : 'cursor-pointer hover:bg-gray-100',
  ]
    .filter(Boolean)
    .join(' ');

  /* ─────────────────────── Quiz Modal State ──────────────────────────────── */
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);

  /* ─────────────────────── Slideshow handlers ───────────────────────────── */
  const handleViewAllSlides = () => {
    const reviewInfo = getReviewNode();
    const reviewId = reviewInfo.exist ? reviewInfo.id : null;

    const mainNodeOrder = preorder.filter((id) => id !== reviewId);
    const nodeOrder = reviewId ? [...mainNodeOrder, reviewId] : mainNodeOrder;

    const allSlidesInOrder: ResourceCard[] = [];
    nodeOrder.forEach((nodeId) => {
      const nodeTitle = getNodeTitle(nodeId) || 'Untitled';

      selectNoteCards(nodeId).forEach((raw) =>
        allSlidesInOrder.push({ ...raw, conceptNodeTitle: nodeTitle })
      );
      selectPictures(nodeId).forEach((raw) =>
        allSlidesInOrder.push({ ...raw, conceptNodeTitle: nodeTitle })
      );
      selectCueCards(nodeId).forEach((raw) =>
        allSlidesInOrder.push({ ...raw, conceptNodeTitle: nodeTitle })
      );
      selectPracticeSheets(nodeId).forEach((raw) =>
        allSlidesInOrder.push({ ...raw, conceptNodeTitle: nodeTitle })
      );
    });

    openCustom(allSlidesInOrder);
  };

  const handleViewFlashCards = () => {
    const reviewInfo = getReviewNode();
    const reviewId = reviewInfo.exist ? reviewInfo.id : null;

    const mainNodeOrder = preorder.filter((id) => id !== reviewId);
    const nodeOrder = reviewId ? [...mainNodeOrder, reviewId] : mainNodeOrder;

    const cueSlidesInOrder: ResourceCard[] = [];
    nodeOrder.forEach((nodeId) => {
      const nodeTitle = getNodeTitle(nodeId) || 'Untitled';

      selectCueCards(nodeId).forEach((raw) =>
        cueSlidesInOrder.push({ ...raw, conceptNodeTitle: nodeTitle })
      );
    });

    openCustom(cueSlidesInOrder);
  };

  /* ─────────────────────────────── Render ──────────────────────────────── */
  return (
    <div
      className="flex-1 flex flex-col map-canvas map-border rounded-md relative"
      data-testid="canvas-viewer"
    >
      {/* ── Sticky title label & drop-down textarea (Concept-Map view only) ── */}
      {activeView === 'conceptMap' && (
        <>
          {/* Label */}
          <div
            className={labelClasses}
            title={isSaving ? 'Saving…' : lessonTitle}
            onClick={() => !isSaving && setIsEditingTitle(true)}
          >
            {lessonTitle}
          </div>

          {/* Textarea shown directly beneath label when editing */}
          {isEditingTitle && !isSaving && (
            <div className="absolute top-10 left-16 z-30 w-[420px]">
              <textarea
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitleChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitTitleChange();
                    e.preventDefault();
                  }
                  if (e.key === 'Escape') {
                    setIsEditingTitle(false);
                  }
                }}
                className="
                  w-full
                  h-14
                  border border-gray-300
                  rounded
                  px-2 py-1
                  text-sm
                  resize-none
                  shadow
                  focus:outline-none
                  focus:ring-1 focus:ring-blue-500
                  bg-white
                "
                rows={2}
                autoFocus
              />
            </div>
          )}
        </>
      )}

      {/* ── Top Toolbar ───────────────────────────────────────────────────────── */}
      <TopToolbar
        activeView={activeView}
        onSearch={openSearchModal}
        onShare={() => {
          /* stubbed or actual share logic can go here */
        }}
        canUndo={canUndo}
        canRedo={canRedo}
        undo={undo}
        redo={redo}
        multiSelectEnabled={multiSelectEnabled}
        toggleMultiSelectEnabled={toggleMultiSelectEnabled}
        openQuizModal={() => setIsQuizModalOpen(true)}
        onViewAllSlides={handleViewAllSlides}
        onViewFlashCards={handleViewFlashCards}
      />

      {/* ── Panels container ─────────────────────────────────────────────── */}
      <div className="relative flex-1">
        {/* Concept-Map panel */}
        <div
          className={`view-panel map-panel ${
            activeView !== 'conceptMap' ? 'hidden' : ''
          }`}
        >
          <div className={colorTheme}>
            <MapRenderer />
          </div>
        </div>

        {/* PDF panel */}
        <div
          className={`view-panel pdf-panel ${
            activeView !== 'pdf' ? 'hidden' : ''
          }`}
        >
          <PDFRenderer
            ref={pdfRef}
            fileUrl={selectedPdfUrl}
            scale={pdfScale}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {/* ── Bottom Toolbar ─────────────────────────────────────────────────── */}
      <BottomToolbar
        activeView={activeView}
        zoomLevel={activeView === 'conceptMap' ? zoomLevel : pdfScale}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        pdfPageInfo={
          activeView === 'pdf'
            ? { current: pdfCurrentPage, total: pdfTotalPages }
            : undefined
        }
        onPdfPrevPage={activeView === 'pdf' ? handlePdfPrev : undefined}
        onPdfNextPage={activeView === 'pdf' ? handlePdfNext : undefined}
        onPdfGoToPage={activeView === 'pdf' ? handlePdfGoToPage : undefined}
      />

      {/* ── Quiz Modal ─────────────────────────────────────────────────────── */}
      {isQuizModalOpen &&
        ReactDOM.createPortal(
          <QuizGeneratorModal
            isOpen
            onClose={() => setIsQuizModalOpen(false)}
            preselectedTopicIds={[]}
          />,
          document.body
        )}
    </div>
  );
};

export default CanvasView;
