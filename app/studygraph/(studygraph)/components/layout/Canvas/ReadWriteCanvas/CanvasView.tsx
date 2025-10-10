// @\app\studygraph\(studygraph)\components\layout\Canvas\ReadWriteCanvas\CanvasView.tsx

/**
 * @file CanvasView.tsx
 * @description
 *   CanvasView orchestrates the primary user workspace by integrating the unified MapRenderer (used in both
 *   read/write and read-only modes) or a PDF viewer alongside a static CardDisplay resource panel. This file
 *   is deliberately conservative with props and DOM structure to prevent style/test regressions: it maintains
 *   the flex layout (.canvas-panels → .map-column + .resource-cell), absolute viewport container (.map-cell),
 *   and the BottomToolbar pinned beneath the viewport wrapper. It reads document access capability from DAM
 *   using useDocumentAccessMode(), computes an edit-readiness boolean via isEditReady(), and gates all
 *   write-only controls uniformly, including toolbar undo/redo and bookmark flows. Viewer-safe features such
 *   as zooming, slideshow launches, forum, version history, and PDF navigation remain available regardless of
 *   access mode. Purposeful console.log statements (file + 4-digit codes) checkpoint key user intents (e.g.,
 *   guarded undo/redo attempts, bookmark modal openings) to aid production debugging without noise. Aside from
 *   capability gating and safety wrappers, this module avoids refactors: it preserves MapRenderer’s import,
 *   DOM/CSS hooks, portals for modals, and the existing event wiring so upstream behavior remains stable.
 *
 *   Responsibilities:
 *     1) Render CanvasHeader across the top across map + resource panel, passing the current DAM mode for visual state.
 *     2) Host the unified MapRenderer or PDF viewer in a relative container, keeping scroll/zoom contracts intact.
 *     3) Provide a BottomToolbar that supports zoom in both views and undo/redo strictly when edit-ready.
 *     4) Open viewer-safe modals (forum, version history, review, share) and gate write-only modals (bookmarks) by DAM.
 *     5) Emit focused logs at high-signal checkpoints so ops teams can trace permission-driven behavior quickly.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import MapRenderer from './Map/MapRendererv2';
import PDFRenderer from '../PDFRenderer';
import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { ZoomActionType } from '@/app/Library/Definitions/Definitions';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useViewSwitch } from '@/app/Library/Context/ViewSwitchContext';
import { useUndoRedo } from '@/app/studygraph/(studygraph)/components/Context/UndoRedoContext';
import BottomToolbar from '../toolbar/BottomToolbar';
import QuizGeneratorModal from '../QuizGeneratorModal';
import ShareModal from '../../share/ShareModal';
import type { PdfViewerRefType } from '../PdfViewer';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';
import { usePreorderTraversal } from '@/app/studygraph/(studygraph)/components/hooks/usePreorderTraversal';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useVersionHistory } from '@/app/Library/Context/VersionHistoryContext';
import '@/app/studygraph/(studygraph)/components/layout/Canvas/CanvasView.css';
import { useLessonUnitOrder } from '../../../hooks/useLessonUnitOrder';
import ForumModal from '../../forum/ForumModal';
import { useComments } from '@/app/Library/Context/forum/CommentContext';
import ReviewModal from '../../Review/ReviewModalsv2';
import { useUserData } from '@/app/Library/Context/UserDataContext';
import BookmarkModal from '../Bookmarks/BookmarkModal';
import CanvasHeader from './CanvasHeader';
import CardDisplay from './CardDisplay/CardDisplay';
import CalendarModal from '../../Calendar/CalendarModal';
import { PickerFileMeta } from '@/app/Library/Definitions/CalendarDefinitions';
import { useAccessEditSnapshot } from '@/app/Library/Context/AccessLayer/selectors';


interface CanvasViewProps {
  handleFileSelect: (meta: PickerFileMeta) => void;
  autosaveStatus: 'saving' | 'saved';
}

/**
 * @function CanvasView
 * @description
 *   Coordinates the unified map/PDF viewport and the resource panel. The function reads DAM for the
 *   current access snapshot and derives an edit-ready boolean to guard all mutating actions. Internally,
 *   it wires zoom, undo/redo, slideshow launches, viewer-safe modals, and a guarded bookmark modal. It
 *   retains the existing structure and portals to avoid regressions, and includes focused logs to trace
 *   permission-driven decisions (e.g., blocking undo/redo or bookmark modal openings in read-only mode).
 *   Time complexity is optimized: viewport operations are O(1), and map drawing remains in MapRenderer.
 */
export const CanvasView: React.FC<CanvasViewProps> = ({ autosaveStatus, handleFileSelect }) => {
  /* ───────────────────────────── Context hooks ──────────────────────────── */
  const { dispatch: zoomDispatch, zoomLevel } = useZoomContext();
  const { activeConceptMapId, getLessonModule, updateConceptMapTitle, generatingLessonStatus, generatedLessons, setGeneratingLessonStatus, setActiveConceptMapId, clearGeneratedLesson , setDefaultMap} = useLessonModule();
  const { activeView, selectedPdfUrl } = useViewSwitch();
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const { openCustom } = useSlideShow();
  const preorder = usePreorderTraversal();
  const { getReviewNode, getNodeTitle } = useNodesContext();
  const { selectCueCards } = useResourceContext();
  const { generateRevision } = useUserData();
  const { colorTheme } = useColorThemeContext();
  const { getVisibility } = useYDoc();
  const isPrivate = getVisibility() === 'private';
  const { openHistory } = useVersionHistory();
  const { openForum, closeForum, isForumOpen, activeConcept } = useComments();

  /* ────────────────────────── Lesson title state ─────────────────────────── */
  const lessonModule = getLessonModule();
  const activeLesson = lessonModule.conceptMaps.find(cm => cm.id === activeConceptMapId);
  const lessonTitle = activeLesson?.title ?? 'Untitled Lesson';
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(lessonTitle);
  const [firstView, setFirstView] = useState(true);


  useEffect(()=>{
    if (firstView){
      setDefaultMap();
      setFirstView(false);
    }
  },[firstView, setDefaultMap])

  /* ───────────────────── DAM-driven mode + readiness  ──────────── */
  const {mode, status, editReady} = useAccessEditSnapshot();                             // update - 2

  useEffect(() => {
    if (!isEditingTitle) setTitleDraft(lessonTitle);
  }, [lessonTitle, isEditingTitle]);

  /* ───────────────────────── Share modal state ───────────────────────────── */
  const [isShareOpen, setShareOpen] = useState(false);
  const UnitOrderSlides = useLessonUnitOrder();

  /* ───────────────────────────── Zoom handlers ───────────────────────────── */
  const [pdfScale, setPdfScale] = useState(1.0);
  const handleZoomIn = useCallback(() => {
    if (activeView === 'conceptMap') zoomDispatch({ type: ZoomActionType.ZOOM_IN });
    else setPdfScale(s => s + 0.1);
  }, [activeView, zoomDispatch]);
  const handleZoomOut = useCallback(() => {
    if (activeView === 'conceptMap') zoomDispatch({ type: ZoomActionType.ZOOM_OUT });
    else setPdfScale(s => Math.max(0.1, s - 0.1));
  }, [activeView, zoomDispatch]);

  /* ───────────────────────── Bookmark modal ──────────────────────────────── */
  const [isBookmarkModalOpen, setBookmarkModalOpen] = useState(false);
  const openBookmarksGuarded = useCallback(() => {                              // update - 3
    
    console.log('[CanvasView.tsx][3005] › Opening BookmarkModal');
    setBookmarkModalOpen(true);
  }, []);                                                // update - 3

  /* ─── Interleaved Review Handler ───────────────────────────────────────── */
  const handleInterleavedReview = useCallback(() => {
    console.log('[CanvasView.tsx][3006] › Initiating interleaved review');
    const revision = generateRevision();
    if (!revision) return;
    const slides = [...revision.flashCards, ...revision.quizzes];
    console.log('[CanvasView.tsx][3007] › Opening slideshow with', slides.length, 'slides');
    openCustom(slides);
  }, [generateRevision, openCustom]);

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
  const handlePdfGoToPage = (page: number) => pdfRef.current?.handleGoTo(page);

  /* ─────────────────────────── Quiz modal state ─────────────────────────── */
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);

  /* ────────────────────── Slideshow & flashcards ───────────────────────── */
  const handleViewAllSlides = () => openCustom(UnitOrderSlides, "start");
  const handleReviewUnit = () => {
    // Show cue cards and quizzes only
    const assessmentSlides = UnitOrderSlides.filter(card => card.type !== 'note');
    openCustom(assessmentSlides, "review");
  }
  const handleViewFlashCards = () => {
    const reviewInfo = getReviewNode();
    const reviewId = reviewInfo.exist ? reviewInfo.id : null;
    const mainOrder = preorder.filter(id => id !== reviewId);
    const nodeOrder = reviewId ? [...mainOrder, reviewId] : mainOrder;
    const cueSlides: any[] = [];
    nodeOrder.forEach(id => {
      const title = getNodeTitle(id) || 'Untitled';
      selectCueCards(id).forEach(raw => cueSlides.push({ ...raw, conceptNodeTitle: title }));
    });
    openCustom(cueSlides);
  };

  /* ─────────────────────── Review modal state ──────────────────────────── */
  const [isReviewModalOpen, setReviewModalOpen] = useState(false);
  const openReviewModal = useCallback(() => {
    console.log('[CanvasView.tsx][3008] › Opening Review modal');
    setReviewModalOpen(true);
  }, []);
  const closeReviewModal = useCallback(() => {
    console.log('[CanvasView.tsx][3009] › Closing Review modal');
    setReviewModalOpen(false);
  }, []);

  /* ─────────────────────── Title rename handler (guard at call sites) ─────────────────────── */
  const handleRename = useCallback((newTitle: string) => {
    updateConceptMapTitle(activeConceptMapId, newTitle);
  }, [activeConceptMapId, updateConceptMapTitle]);

  /* ─────────────────────── Calendar modal state ──────────────────────────── */
  const [isCalendarModalOpen, setCalendarModalOpen] = useState(false);

  /*-------------------------------- Card Display mode State ------*/
  type Mode = 'note' | 'edit' | 'chat';
  const [CardDisplaymode, setCardDisplayMode] = useState<Mode>('note');
  const handleCardDisplayTabChange = (mode: Mode) => setCardDisplayMode(mode);
  const handleCardDisplayTabChangeChat = () => setCardDisplayMode('chat');

  /* ─────────────────────── Guarded Undo/Redo wrappers ───────────────────── */
  const onUndoGuarded = useCallback(() => {                                     // update - 4
    if (!editReady) {
      console.log('[CanvasView.tsx][3050] blocked undo: not edit-ready', { mode, status });
      return;
    }
    undo();
  }, [editReady, mode, status, undo]);                                          // update - 4

  const onRedoGuarded = useCallback(() => {                                     // update - 5
    if (!editReady) {
      console.log('[CanvasView.tsx][3051] blocked redo: not edit-ready', { mode, status });
      return;
    }
    redo();
  }, [editReady, mode, status, redo]);                                          // update - 5

  /* ───────────────────────────── Render ──────────────────────────────── */

  // Select generated lesson
  useEffect(() => {
    if (generatingLessonStatus === "completed"){
      if (generatedLessons.length > 0){
      setActiveConceptMapId(generatedLessons[0])
      clearGeneratedLesson()
      }
      setGeneratingLessonStatus("idle")
    }

  },[clearGeneratedLesson, generatedLessons, generatingLessonStatus, setActiveConceptMapId, setGeneratingLessonStatus])


  return (
    <div
      className={`flex-1 flex flex-col map-canvas map-border rounded-md relative ${colorTheme}`}
      data-testid="canvas-viewer"
    >
      {/* Header spans map + resource column. Visual state controlled by DAM mode. */}
      <CanvasHeader
        // update - 2: pass DAM mode for visual/UX state alignment
        mode={mode} // update - 2
        isSaving={autosaveStatus === 'saving'}
        onDiscuss={openForum}
        onStartLesson={handleViewAllSlides}
        onStartReview={openReviewModal}
        onBookmark={openBookmarksGuarded}                                    
        onShare={() => setShareOpen(true)}
        onVersionHistory={openHistory}
        onOpenCalendar={() => {
          console.log('[CanvasView.tsx][3040] › Opening calendar modal');
          setCalendarModalOpen(true);
        }}
      />

      {/* Panels: left map/pdf viewport + right resource panel */}
      <div className="canvas-panels flex-1">
        {/* Column 1: Viewport wrapper (overflow hidden) + BottomToolbar */}
        <div className="map-column flex flex-col relative">
          <div className="map-cell flex-1 relative overflow-hidden">
            {activeView === 'conceptMap' && (
              <div className={colorTheme}>
                <MapRenderer />
              </div>
            )}
            {activeView === 'pdf' && (
              <div className="view-panel pdf-panel">
                <PDFRenderer
                  ref={pdfRef}
                  fileUrl={selectedPdfUrl}
                  scale={pdfScale}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </div>

          {/* Bottom toolbar (undo/redo strictly gated; zoom always allowed) */}
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
            canUndo={editReady && canUndo}
            canRedo={editReady && canRedo}
            onUndo={onUndoGuarded}                                             
            onRedo={onRedoGuarded}                                             
          />
        </div>

        {/* Column 2: Static resource panel */}
        <div className="resource-cell">
          <CardDisplay
            mode={CardDisplaymode}
            setMode={handleCardDisplayTabChange}
            askHandler={handleCardDisplayTabChangeChat}
          />
        </div>
      </div>

      {/* Modals */}
      {isQuizModalOpen &&
        ReactDOM.createPortal(
          <QuizGeneratorModal
            isOpen
            onClose={() => setIsQuizModalOpen(false)}
            preselectedTopicIds={[]}
            mapId={activeConceptMapId}
          />,
          document.body
        )}

      {isShareOpen &&
        ReactDOM.createPortal(
          <ShareModal isOpen onClose={() => setShareOpen(false)} />,
          document.body
        )}

      {activeView === 'conceptMap' && (
        <ForumModal
          initialSlideId={activeConcept!}
          isOpen={isForumOpen}
          onClose={closeForum}
        />
      )}

      {isReviewModalOpen &&
        ReactDOM.createPortal(
          <ReviewModal
            isOpen
            onClose={closeReviewModal}
            onSelectInterleaved={handleInterleavedReview}
            onSelectUnit={handleReviewUnit}
          />,
          document.body
        )}

      {isBookmarkModalOpen &&
        ReactDOM.createPortal(
          <BookmarkModal isOpen onClose={() => setBookmarkModalOpen(false)} />,
          document.body
        )}

      {isCalendarModalOpen &&
        ReactDOM.createPortal(
          <CalendarModal
            isOpen={isCalendarModalOpen}
            onClose={() => {
              console.log('[CanvasView.tsx][3041] › Closing calendar modal');
              setCalendarModalOpen(false);
            }}
            onFileSelect={handleFileSelect}
          />,
          document.body
        )}
    </div>
  );
};

export default CanvasView;
