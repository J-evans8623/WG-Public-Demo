/**
 * @file CanvasView.tsx (Legacy Edit version)
 * @description
 *   CanvasView orchestrates the primary user workspace by seamlessly integrating the interactive concept map
 *   or PDF viewer with a static resource panel displaying study materials such as cue cards, quizzes, and
 *   bookmarks. It establishes a robust flex‐based layout that maintains existing absolute positioning for
 *   core rendering panels while introducing a side‐by‐side CardDisplay component on the right. Leveraging
 *   extensive React context hooks for zoom, view switching, undo/redo, search, slideshow initiation,
 *   resource management, comment handling, user data, and version history, CanvasView preserves all
 *   pre‐existing map and PDF behaviors. Purposeful console.log statements with unique four‑digit codes trace
 *   critical execution, including layout changes and modal openings. This architecture ensures the
 *   CanvasHeader spans both the map and resource panel, and the BottomToolbar retains full functionality.
 *
 * Responsibilities:
 *   1. Render CanvasHeader across the top of the canvas area, spanning both map and resource panel.
 *   2. Create a horizontal flex container that holds:
 *      2.1. A relative‐positioned wrapper for absolute‐positioned view panels (concept map or PDF).
 *      2.2. A static, scrollable CardDisplay resource panel to the right.
 *   3. Preserve existing behaviors: zoom, pan, PDF navigation, autosave status, and all modal portals.
 *   4. Provide console.log checkpoints with unique codes for debugging layout and state transitions.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import MapRenderer from './MapRenderer';
import PDFRenderer from './PDFRenderer';
import { useZoomContext } from '@/app/Library/Context/ZoomProvider';
import { ZoomActionType } from '@/app/Library/Definitions/Definitions';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useViewSwitch } from '@/app/Library/Context/ViewSwitchContext';
import { useUndoRedo } from '@/app/studygraph/(studygraph)/components/Context/UndoRedoContext';
import BottomToolbar from './toolbar/BottomToolbar';
import QuizGeneratorModal from './QuizGeneratorModal';
import ShareModal from '../share/ShareModal';
import type { PdfViewerRefType } from './PdfViewer';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';
import { usePreorderTraversal } from '@/app/studygraph/(studygraph)/components/hooks/usePreorderTraversal';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useColorThemeContext } from '@/app/Library/Context/ColorThemeProvider';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useVersionHistory } from '@/app/Library/Context/VersionHistoryContext';
import './CanvasView.css';
import { useLessonUnitOrder } from '../../hooks/useLessonUnitOrder';
import ForumModal from '../forum/ForumModal';
import { useComments } from '@/app/Library/Context/CommentContext';
import ReviewModal from '../Review/ReviewModalsv2';
import { useUserData } from '@/app/Library/Context/UserDataContext';
import BookmarkModal from './Bookmarks/BookmarkModal';
import CanvasHeader from './ReadWriteCanvas/CanvasHeader'
import CardDisplay from '../CardDisplay/v2/CardDisplay';
import CalendarModal from '../Calendar/CalendarModal';
import { PickerFileMeta } from '@/app/Library/Definitions/CalendarDefinitions';
import { useDocumentAccessMode, isEditReady } from '@/app/studygraph/(studygraph)/components/hooks/access/useDocumentAccessMode';

interface CanvasViewProps {
  handleFileSelect: (meta: PickerFileMeta) => void;
  autosaveStatus: 'saving' | 'saved';
}

/**
 * @function CanvasView
 * @description
 *   Coordinates rendering of the primary learning workspace by displaying either a concept map
 *   or a PDF viewer alongside a static CardDisplay panel. It uses a flex row so that
 *   absolute-positioned rendering panels live inside a relative flex‐1 wrapper while the
 *   CardDisplay panel remains a static sibling to the right. React context hooks manage zoom,
 *   view switching, lesson-title editing, undo/redo, search, slideshows, resources, comments,
 *   theming, version history, and user data. CanvasHeader and BottomToolbar integrate
 *   seamlessly, and purposeful console.logs with unique codes trace key layout and modal events.
 *
 * @param {CanvasViewProps} props Only autosaveStatus is actively used in this component.
 */
export const CanvasView: React.FC<CanvasViewProps> = ({ autosaveStatus , handleFileSelect }) => {
  /* ───────────────────────────── Context hooks ──────────────────────────── */
  const { dispatch: zoomDispatch, zoomLevel } = useZoomContext();
  const { activeConceptMapId, getLessonModule, updateConceptMapTitle } = useLessonModule();
  const { activeView, selectedPdfUrl, resetPdfState } = useViewSwitch();
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
  const { getCommentCount, openForum, closeForum, isForumOpen, activeConcept } = useComments();

  /* ────────────────────────── Lesson title state ─────────────────────────── */
  const lessonModule = getLessonModule();
  const activeLesson = lessonModule.conceptMaps.find(cm => cm.id === activeConceptMapId);
  const lessonTitle = activeLesson?.title ?? 'Untitled Lesson';
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(lessonTitle);

    /* ───────────────────── DAM-driven mode + readiness  ──────────── */
  const { mode, status } = useDocumentAccessMode();                            
  const editReady = useMemo(() => isEditReady(mode, status), [mode, status]); 

  
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
  const openBookmarks = useCallback(() => {
    console.log('[CanvasView.tsx][3005] › Opening BookmarkModal');
    setBookmarkModalOpen(true);
  }, []);

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
  const handleViewAllSlides = () => openCustom(UnitOrderSlides);
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


    const handleRename = useCallback((newTitle: string) => {
    updateConceptMapTitle(activeConceptMapId, newTitle);
  }, [activeConceptMapId, updateConceptMapTitle]);

 /* ─────────────────────── Calendar modal state ──────────────────────────── */
  const [isCalendarModalOpen, setCalendarModalOpen] = useState(false);


  /*-------------------------------- Card Display mode State ------*/
  type Mode = 'note' | 'edit' | 'chat';
  const [CardDisplaymode, setCardDisplayMode] = useState<Mode>('note');

  const handleCardDisplayTabChange = (mode:Mode) => {
    setCardDisplayMode(mode);
  }

    const handleCardDisplayTabChangeChat = () => {
    setCardDisplayMode('chat');
  }

  /* ───────────────────────────── Render ──────────────────────────────── */
  return (
    <div
      className={`flex-1 flex flex-col map-canvas map-border rounded-md relative ${colorTheme}`}
      data-testid="canvas-viewer"
    >
      {/* Step 1: Render integrated header in conceptMap view */}
        <CanvasHeader
        // update - 2: pass edit mode to enable full interactions in unified header
        mode={mode} // update - 2
        isSaving={autosaveStatus === 'saving'}
        onDiscuss={openForum}
        onStartLesson={handleViewAllSlides}
        onStartReview={openReviewModal}
        onBookmark={() => setBookmarkModalOpen(true)}
        onShare={() => setShareOpen(true)}
        onVersionHistory={openHistory}
        onOpenCalendar={() => {
          console.log('[CanvasView.tsx][3040] › Opening calendar modal');
          setCalendarModalOpen(true);
        }}
      />
    

{/** ──────────────────────────────────────────────────────────────── **/
 /* Step 2 & 3: Layout for Map/PDF, Resource Panel, and BottomToolbar */
 /** ──────────────────────────────────────────────────────────────── **/}
<div className="canvas-panels flex-1">

  {/** ─── Column 1: Map/PDF + BottomToolbar ─── **/}
  <div className="map-column flex flex-col relative">

    {/** 3.1: Viewport wrapper (overflow‑hidden) **/}
    <div className="map-cell flex-1 relative overflow-hidden" >
      {activeView === 'conceptMap' && (
        
          <div className={colorTheme}  >
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
    

    {/** 4: Bottom‑centered toolbar, sits outside the overflow container **/}
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
      onUndo={undo}
      onRedo={redo}
    />
  </div>

  {/** ─── Column 2: Static Resource Panel ─── **/}
    <div className="resource-cell">
      <CardDisplay mode={CardDisplaymode} setMode={handleCardDisplayTabChange} askHandler={handleCardDisplayTabChangeChat} />
    </div>
  
</div>


      {/* Step 5: Modals */}
      {isQuizModalOpen &&
        ReactDOM.createPortal(
          <QuizGeneratorModal
            isOpen
            onClose={() => setIsQuizModalOpen(false)}
            preselectedTopicIds={[]}
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
            onSelectUnit={() => console.log('[CanvasView.tsx][3012] › Unit review selected')}
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
        onFileSelect={handleFileSelect} // Pass AppLayout's file selection handler
      />, document.body
  )}
    </div>
  );
};

export default CanvasView;
