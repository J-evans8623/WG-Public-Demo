// bloom-maps/app/workspace/(studygraph)/components/layout/CardDisplay/Cards/SlideShowOverlay.tsx

/**
 * @file SlideShowOverlay.tsx (Unified, legacy contract-aligned) 
 * @description
 * 1) Responsibility: This component renders the slideshow overlay using the **original legacy DOM structure
 *    and class tokens** so that SlideShowv2.css applies 1:1. It displays Note, CueCard, and PracticeSheet slides,
 *    mounts a modal with backdrop via a portal, and provides navigation, discussion, bookmarking, Ask Assistant,
 *    and (when allowed) Edit entry points.
 * 2) Access Mode: The overlay reads the document access state and **hides Edit entirely** when the app is in
 *    read-only mode. Differences between RO/RW are otherwise expressed by enabling/disabling buttons—never by
 *    changing the layout tokens, preserving CSS parity.
 * 3) Contracts: We adhere to legacy header (`slideshow-header-left`, `slideshow-header-actions`), footer
 *    (`slideshow-footer-actions`, `slideshow-slide-nav`), button (`slideshow-header-btn`, `slideshow-nav-btn`,
 *    `slideshow-nav-btn-next`), and counter (`slideshow-counter-*`) class names. AskAssistantPanel uses the
 *    legacy mount/unmount pattern (only `onClose` and `onLoading`), ensuring O(1) state flips.
 * 4) Observability: Purposeful console logs (codes 1201–1402) mark open/close, navigation, ask panel state,
 *    and key tasks. All per-interaction work is O(1); mapping over slides or parsing JSON is O(N) at most.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
// update - 1: Replace icon set usage to align with legacy buttons (text nav + icons only where used)
import { X, BookmarkIcon, MessageSquare, Brain, Pencil } from 'lucide-react'; // update - 1
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';
import { parseJumpToIndex, makeKeydownHandler, focusInput, autoAdvanceOnAskCompletion } from './OverlayBehaviors'; // update - 3
import NoteCard from '../../../CardDisplay/Cards/NoteCard';
import CueCard from '../../../CardDisplay/Cards/CueCard';
import QuizCard from '../Cards/QuizCard'; 
import AskAssistantPanel from '../../../CardDisplay/Cards/AskAssistantPanel';
import '@/app/workspace/(studygraph)/components/layout/CardDisplay/Cards/SlideShowv2.css';

//import { useComments } from '@/app/Library/Context/forum/CommentContext';
//import DiscussionFormInput from '../../../forum/DiscussionFormInput';
import { useUserData } from '@/app/Library/Context/UserDataContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useYDoc } from '@/app/Library/Context/YDocContext';

import SlideShowEditForm from '../../../CardDisplay/Cards/SlideShowEditForm';
import { useAccessEditSnapshot } from '@/app/Library/Context/AccessLayer/selectors';

// update - 18: Imports for Study Log integration
import { useStudyLog } from '@/app/Library/Context/studylog/StudyLogContext';
import { calculateMaxStudyTime, isSignificantDuration } from '@/app/Library/Context/studylog/StudyLogHeuristic';

import { useCalendar } from '@/app/Library/Context/CalendarContextv2';
import { useViewSwitch } from '@/app/workspace/(studygraph)/components/layout/Canvas/pdf/ViewSwitchContext';
import StudyPlanButton from '../../../Calendar/StudyPlanButton';

import { useSlideComments } from '@/app/Library/Context/SlideCommentsContext';
import SlideCommentsModal from './SlideCommentsModal';

/**
 * @function SlideShowOverlay
 * @description
 * Renders the active slide in a modal overlay with original markup/class tokens required by SlideShowv2.css.
 * Provides: navigation (prev/next, jump-to), bookmarking, discussion creation, Ask Assistant (legacy panel),
 * and editing (only in RW). Hides Edit entirely in RO based on document access readiness, minimizing layout
 * churn. Keyboard shortcuts are active unless blocked by inline editing or Ask state. All event handlers are
 * O(1); slide rendering is O(1) per slide except JSON parsing for quizzes (O(N) on content length).
 */
const SlideShowOverlay: React.FC = () => {
  const {
    slides,
    isOpen,
    currentIndex,
    currentSlide,
    close,
    gotoNext,
    gotoPrev,
    open,
  } = useSlideShow();
  const {isReadOnly, docFileID} = useYDoc();

  /**
   * @description
   * Consume the slide comments context directly inside the overlay so the header badge and footer trigger
   * always reflect the current slide’s comment state without introducing duplicate local stores.
   */
  const {
    activeDocId: activeCommentsDocId,
    isHydrated: areCommentsHydrated,
    isLoading: areCommentsLoading,
    loadDocumentComments,
    getCommentCountForSlide,
    hasCommentsForSlide,
  } = useSlideComments();


  // update - 18: Consume Study Log Context
  const { logTime } = useStudyLog();
  // Ref to track the start time of the current slide interaction
  const startTimeRef = useRef<number>(0);

  
  const {mode, status, editReady} = useAccessEditSnapshot();

  // Consume Calendar and ViewSwitch contexts
  const { isNotebookTracked, selectNotebook, ManualUpdate } = useCalendar();
  const { requestCalendarSelector } = useViewSwitch();

  const caps = useMemo(() => {
    const canEdit = editReady && !isReadOnly
    // We keep Ask enabled in RW and disabled in RO, but only Edit is *hidden* in RO (per requirement)
    return { canEdit, canAsk: canEdit, canDiscuss: true, canBookmark: true };
  }, [editReady, isReadOnly]); // update - 5

  const [cueFlipped, setCueFlipped] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [askLoading, setAskLoading] = useState(false);
  const prevAskLoading = useRef(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSlideNumber, setIsEditingSlideNumber] = useState(false);
  const [tempSlideNumber, setTempSlideNumber] = useState('');
  const slideInputRef = useRef<HTMLInputElement>(null);
  const [commentsModalOpen, setCommentsModalOpen] = useState(false);
  const { toggleBookmark, isBookmarked } = useUserData();
  const { getGlobalNode } = useNodesContext();
  //const { addPost } = useComments();

  const total = slides.length;
  const nodetitle = currentSlide ? getGlobalNode(currentSlide.mapId, currentSlide.nodeId)?.title : '';
  const bookmarked = currentSlide ? isBookmarked(currentSlide.id) : false;

   /**
   * @description
   * Derive current-slide comment presence and count using O(1) slideId selectors from SlideCommentsContext.
   * These values drive both the top-right badge state and the footer + Comment trigger label if needed.
   */
  const currentSlideCommentCount = currentSlide ? getCommentCountForSlide(currentSlide.id) : 0;
  const currentSlideHasComments = currentSlide ? hasCommentsForSlide(currentSlide.id) : false;

  useEffect(() => {
    if (isOpen) console.log('[SlideShowOverlay.tsx][1201] overlay open; total slides:', total, 'mode:', mode, 'status:', status);
  }, [isOpen, total, mode, status]);

  useEffect(() => {
    if (!isOpen) return;
    console.log('[SlideShowOverlay.tsx][1202] slide index →', currentIndex);
    setAskOpen(false);
    setCueFlipped(false);
     setCommentsModalOpen(false);
    setIsEditing(false);
    setIsEditingSlideNumber(false);
  }, [isOpen, currentIndex]);



  useEffect(() => {
    // O(1) check + side-effects; auto-advance remains unchanged
    autoAdvanceOnAskCompletion(prevAskLoading.current, askLoading, askOpen, gotoNext);
    prevAskLoading.current = askLoading;
  }, [askLoading, askOpen, gotoNext]);

  useEffect(() => {
    const disabled = askOpen || askLoading || isEditingSlideNumber || isEditing;
    const isCue = currentSlide?.type === 'cueCard';
    const handler = makeKeydownHandler({
      disabled,
      nav: { gotoNext, gotoPrev, close },
      isCueCard: !!isCue,
      flipCue: () => setCueFlipped((f) => !f),
    });
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [askOpen, askLoading, isEditingSlideNumber, isEditing, currentSlide, gotoNext, gotoPrev, close]);

  useEffect(() => {
    if (isEditingSlideNumber) focusInput(slideInputRef.current);
  }, [isEditingSlideNumber]);



// update - 18: Time Tracking Heuristics
  // Captures start time on mount/update. Calculates duration on unmount/update.
  useEffect(() => {
    if (!isOpen || !currentSlide) return;

    // 1. Start the timer for this slide
    startTimeRef.current = Date.now();

    return () => {
      // 2. On cleanup (slide changed or overlay closed), calculate duration
      const endTime = Date.now();
      const rawDurationSeconds = (endTime - startTimeRef.current) / 1000;

      // 3. Filter noise (accidental clicks < 5s)
      if (isSignificantDuration(rawDurationSeconds)) {
        // 4. Resolve content payload for heuristics (handling diverse resource shapes)
        let heuristicContent: any;
        
        if (currentSlide.type === 'quizAssessment') {
          heuristicContent = currentSlide.binding.spec.quizContent;
        } else {
          // Note, CueCard, PracticeSheet have 'content'. 
          // For Object-based PracticeSheet, extract the array to ensure heuristic counts questions correctly.
          heuristicContent = currentSlide.content;
          if (currentSlide.type === 'practiceSheet' && typeof heuristicContent === 'object') {
             heuristicContent = heuristicContent.quizContent;
          }
        }

        const maxAllowedSeconds = calculateMaxStudyTime(currentSlide.type, heuristicContent);

        // 5. Apply the cap (Actual vs Max)
        const validSeconds = Math.min(rawDurationSeconds, maxAllowedSeconds);

        // 6. Log to context (buffered persistence)
        const notebookId = docFileID!;
        logTime(validSeconds, notebookId);
        
        console.log('[SlideShowOverlay.tsx][1801] Logged study time:', {
            id: currentSlide.id,
            raw: rawDurationSeconds.toFixed(1),
            max: maxAllowedSeconds,
            logged: validSeconds.toFixed(1)
        });
      }
    };
  }, [currentSlide, docFileID, isOpen, logTime]); // Re-runs when slide changes or visibility toggles

  // update - 6: Bookmark action (O(1))
  const handleToggleBookmark = () => {

    if (!currentSlide || currentSlide.type == 'quizAssessment') return;
    console.log('[SlideShowOverlay.tsx][1301] toggle bookmark', { id: currentSlide.id });
    toggleBookmark({
      resourceId: currentSlide.id,
      mapId: currentSlide.mapId!,
      nodeId: currentSlide.nodeId!,
      type: currentSlide.type,
      timestamp: Date.now(),
    });
  };


  //Check if current subject is already in a study plan
  const isTracked = useMemo(() => {
    return docFileID ? isNotebookTracked(docFileID) : true;
  }, [docFileID, isNotebookTracked]);


  /**
   * @function handleAddToPlan
   * @description
   * Orchestrates the transition from reading to planning.
   * 1) Identifies the active notebook via docFileID.
   * 2) Primes the CalendarContext by selecting the notebook.
   * 3) Signals the ViewSwitchContext to open the calendar selector after exit.
   * 4) Closes the slideshow to trigger the jump-gate in CanvasView.
   */
  //  New handler for the Add to Plan intent
  const handleAddToPlan = () => {
    if (!docFileID) return;
    console.log('[SlideShowOverlay.tsx][2001] Add to plan requested for:', docFileID);
    
    // 1. Prime the data layer immediately
    //selectNotebook(docFileID); // legacy
    // We do not await this because we want the UI transition to start immediately, 
    // letting the context finish the data work during the modal's mount cycle.
    ManualUpdate(docFileID);

    //queueNotebookIntegration(docFileID);
    
    // 2. Set the global intent for the calendar selector
    requestCalendarSelector();
    
    // 3. Gracefully exit the slideshow
    close();
  };

  // update - 7: Ask AI respects caps.canAsk (disabled in RO); Edit is *hidden* in RO per new requirement.
  const handleAskClick = () => {
    if (!caps.canAsk) {
      console.log('[SlideShowOverlay.tsx][1302] ask blocked in read-only (visible but disabled)');
      return;
    }
    setAskOpen((o) => !o);
  };

  const handleStartEdit = () => {
    if (!caps.canEdit) return;
    console.log('[SlideShowOverlay.tsx][1303] entering edit mode');
    setIsEditing(true);
  };

  const handleJumpSubmit = () => {
    const idx = parseJumpToIndex(tempSlideNumber, total);
    if (idx === null || !slides[idx]) {
      setIsEditingSlideNumber(false);
      return;
    }
    console.log('[SlideShowOverlay.tsx][1304] jump to slide', idx + 1);
    open(slides[idx].id, false);
    setIsEditingSlideNumber(false);
  };

/**   const handleComposerSubmit = (title: string, content: string) => {
    if (!currentSlide) return;
    console.log('[SlideShowOverlay.tsx][1306] create post for slide', currentSlide.id);
    addPost({
      lessonTitle: nodetitle || 'Current Lesson',
      lessonTitleId: currentSlide.nodeId || 'node',
      subtopicTitle: currentSlide.title || 'Current Slide',
      resourceId: currentSlide.id,
      postTitle: title,
      body: `${content}`,
    });
    setComposerOpen(false);
  }; */


  /**
   * @function handleOpenComments
   * @description
   * Opens the dedicated comment manager modal from either the footer trigger or the top-right comment badge.
   * The modal is now the single interaction surface for all slide comment work, replacing the old Discuss
   * composer path within the slideshow.
   */
  const handleOpenComments = (): void => {
    console.log('[SlideShowOverlay.tsx][1902] open slide comments modal', {
      slideId: currentSlide?.id,
      count: currentSlideCommentCount,
    });
    setCommentsModalOpen(true);
  };


  /**
   * @function handleCloseComments
   * @description
   * Closes the dedicated comment manager modal while preserving the rest of the slideshow overlay state.
   * This keeps comments as an auxiliary surface rather than replacing slideshow navigation itself.
   */
  const handleCloseComments = (): void => {
    console.log('[SlideShowOverlay.tsx][1903] close slide comments modal', {
      slideId: currentSlide?.id,
    });
    setCommentsModalOpen(false);
  };

  if (!isOpen || !currentSlide) return null;

  // update - 8: Render slide (O(1) per render; JSON parse O(N) on content size)
  const renderSlide = () => {
    switch (currentSlide.type) {
      case 'note':
        return <NoteCard title={currentSlide.title} content={String(currentSlide.content)} />;
      case 'cueCard':
        return (
          <div className="cuecard-container" onClick={() => !isEditing && setCueFlipped((f) => !f)}>
            <CueCard title={currentSlide.title} content={String(currentSlide.content)} flipped={cueFlipped} />
          </div>
        );
      case 'practiceSheet': {
        let quizData: any = currentSlide.content;
        if (typeof quizData === 'string') {
          try {
            quizData = JSON.parse(quizData);
          } catch {
            /* ignore */
          }
        }
        return <QuizCard title={nodetitle!} content={quizData} parentQuizId={currentSlide.id} mapId={currentSlide.mapId} />;
      }
      default:
        return null;
    }
  };

  // update - 9: Composer modal uses the same portal host; matches legacy form class + wrapper
  /**if (composerOpen) {
    return ReactDOM.createPortal(
      <>
        <div className="slideshow-backdrop" onClick={() => setComposerOpen(false)} />
        <div className="slideshow-dialog slideshow-discussion-form" role="dialog" aria-modal="true">
          <DiscussionFormInput
            onSubmit={handleComposerSubmit}
            onCancel={() => setComposerOpen(false)}
            contextInfo={{ lessonTitle: nodetitle || 'Current Lesson', slideTitle: currentSlide.title || 'Current Slide' }}
          />
        </div>
      </>,
      document.body
    );
  }   */

  // update - 17: When editing, replace dialog body with the full-screen edit form (restored)
  if (isEditing) { // update - 17
    console.log('[SlideShowOverlay.tsx][1310] Rendering SlideShowEditForm'); // update - 17
    return ReactDOM.createPortal( // update - 17
      <> {/* update - 17 */}
        <div className="slideshow-backdrop" /> {/* update - 17 */}
        <div className="slideshow-dialog slideshow-edit-mode" role="dialog" aria-modal="true"> {/* update - 17 */}
          <SlideShowEditForm
            slide={currentSlide}
            onSave={() => { console.log('[SlideShowOverlay.tsx][1311] Edit saved, exiting edit mode'); setIsEditing(false); }} // update - 17
            onCancel={() => { console.log('[SlideShowOverlay.tsx][1312] Edit canceled, exiting edit mode'); setIsEditing(false); }} // update - 17
          /> {/* update - 17 */}
        </div> 
      </>, 
      document.body 
    ); 
  } 

  // update - 10: Legacy DOM/class tokens restored below (header/footer/counter/nav/buttons)
  return ReactDOM.createPortal(
    <>
      <div className="slideshow-backdrop" onClick={close} />
      <div className="slideshow-dialog" role="dialog" aria-modal="true" aria-label="Slideshow overlay">
        {/* update - 11: Legacy header structure */}
        <header className="slideshow-header"> 
          <div className="slideshow-header-left"> 
            <div className="slideshow-header-concept"> 
              <h1 className="slideshow-concept-name">{nodetitle || 'Current Lesson'}</h1> 
              {currentSlide.title && (
                <span className="slideshow-concept-secondary">{currentSlide.title}</span> 
              )}
            </div>
          </div>


          <div className="slideshow-header-actions"> 
            {/* update - 12: Per requirement, hide Edit entirely when read-only (do not render at all) */}
            {caps.canEdit && ( 
              <button
                className="slideshow-header-btn edit-btn" 
                onClick={handleStartEdit}
                title="Edit this slide"
              >
                <Pencil size={14} />
                Edit
              </button>
            )}


            <button
              className="slideshow-bookmark-btn"
              title={currentSlideHasComments ? `${currentSlideCommentCount} comment(s)` : 'Open comments'}
              onClick={handleOpenComments}
              aria-label="Open comments"
              style={{
                position: 'relative',
                color: currentSlideHasComments ? '#8b6b47' : undefined,
              }}
            >
              <MessageSquare size={16} />
              {currentSlideCommentCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    minWidth: '18px',
                    height: '18px',
                    padding: '0 5px',
                    borderRadius: '999px',
                    background: '#8b6b47',
                    color: '#ffffff',
                    fontSize: '11px',
                    lineHeight: '18px',
                    fontWeight: 700,
                    textAlign: 'center',
                    boxSizing: 'border-box',
                  }}
                >
                  {currentSlideCommentCount > 9 ? '9+' : currentSlideCommentCount}
                </span>
              )}
            </button>


            <button
              className="slideshow-bookmark-btn" 
              title={bookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
              onClick={handleToggleBookmark}
            >
              <BookmarkIcon size={16} className={bookmarked ? 'bookmarked' : ''} />
            </button>
            <button className="slideshow-close" onClick={close} aria-label="Close"> {}
              <X size={16} />
            </button>
          </div>



        </header>

        {/* update - 13: Main body stays unchanged aside from legacy classes */}
        <main className="slideshow-body" title={currentSlide.type === 'cueCard' ? 'Click to flip card' : undefined}> {/* update - 13 */}
          {askLoading ? (
            <div className="slideshow-loading-container"> {/* update - 13 */}
              <div className="slideshow-spinner" /> {/* update - 13 */}
            </div>
          ) : (
            renderSlide()
          )}
        </main>

        {/* update - 14: Legacy footer structure and tokens */}
        <div className="slideshow-footer">
          <div className="slideshow-footer-actions">
            {/* Ask AI: visible in both modes but disabled in RO. */}
            <button
              className="slideshow-header-btn ai-btn" /* update - 14 */
              onClick={() => {
                console.log('[SlideShowOverlay.tsx][1400] Ask Assistant opened');
                handleAskClick();
              }}
              disabled={!caps.canAsk || askLoading}
              aria-disabled={!caps.canAsk || askLoading}
              title={!caps.canAsk ? 'Ask Assistant is disabled in read-only' : 'Ask Assistant'}
            >
              <Brain size={14} />
              Ask AI
            </button>

                        {/* update - 24.1: Replace legacy Discuss action with the dedicated + Comment trigger required by the PRD. */}
            <button
              className="slideshow-header-btn discussion-btn"
              onClick={handleOpenComments}
              title="Open slide comments"
            >
              + Comment
            </button>

            {/* Conditionally render the StudyPlanButton for untracked content */}
            {!isTracked && (
              <StudyPlanButton 
                onClick={handleAddToPlan}
                className="ml-auto" 
              />
            )}
          </div>

          <div className="slideshow-slide-nav"> {/* update - 14 */}
            <button
              className="slideshow-nav-btn" /* update - 14 */
              disabled={currentIndex === 0}
              onClick={() => {
                console.log('[SlideShowOverlay.tsx][1308] Prev');
                gotoPrev();
              }}
            >
              Previous
            </button>

            {/* Counter with jump-to behavior using legacy tokens */}
            <div
              className="slideshow-counter-container" /* update - 14 */
              onClick={() => {
                const blocked = askOpen || askLoading || isEditing;
                if (!blocked) {
                  setTempSlideNumber(String(currentIndex + 1));
                  setIsEditingSlideNumber(true);
                }
              }}
            >
              {isEditingSlideNumber ? (
                <div className="slideshow-counter-input-container"> {/* update - 14 */}
                  <input
                    ref={slideInputRef}
                    className="slideshow-counter-input" /* update - 14 */
                    value={tempSlideNumber}
                    onChange={(e) => /^\d*$/.test(e.target.value) && setTempSlideNumber(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleJumpSubmit();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setIsEditingSlideNumber(false);
                      }
                    }}
                    onBlur={handleJumpSubmit}
                    aria-label="Jump to slide number"
                    inputMode="numeric"
                  />
                  <span className="slideshow-counter-separator"> of </span> {/* update - 14 */}
                  <span className="slideshow-counter-total">{total}</span> {/* update - 14 */}
                </div>
              ) : (
                <button
                  className="slideshow-counter-clickable" /* update - 14 */
                  title="Click to jump to a specific slide"
                  disabled={askOpen || askLoading}
                >
                  <span className="slideshow-counter-current">{currentIndex + 1}</span> {/* update - 14 */}
                  <span className="slideshow-counter-separator"> of </span> {/* update - 14 */}
                  <span className="slideshow-counter-total">{total}</span> {/* update - 14 */}
                </button>
              )}
            </div>

            <button
              className="slideshow-nav-btn slideshow-nav-btn-next" /* update - 14 */
              disabled={currentIndex >= total - 1}
              onClick={() => {
                console.log('[SlideShowOverlay.tsx][1309] Next');
                gotoNext();
              }}
            >
              Next →
            </button>
          </div>
        </div>
      </div>


      {/* Mount the dedicated slide comments modal inside the slideshow portal tree. */}
      <SlideCommentsModal
        isOpen={commentsModalOpen}
        onClose={handleCloseComments}
        currentSlide={currentSlide}
        currentLessonTitle={nodetitle || 'Current Lesson'}
      />

      {/* update - 15: Legacy mount/unmount for Ask Assistant with only onClose/onLoading */}
      {askOpen && (
        <AskAssistantPanel
          onClose={() => {
            console.log('[SlideShowOverlay.tsx][1401] ask panel closed (legacy mount/unmount)');
            setAskOpen(false);
          }}
          onLoading={(v) => {
            console.log('[SlideShowOverlay.tsx][1402] ask loading →', v);
            setAskLoading(v);
          }}
        />
      )}
    </>,
    document.body
  );
};

export default SlideShowOverlay;
