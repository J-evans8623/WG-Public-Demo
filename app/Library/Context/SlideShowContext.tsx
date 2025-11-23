/** // bloom-maps\app\studygraph\(studygraph)\components\layout\Canvas\ReadWriteCanvas\Context\SlideShowContext.tsx
 * @file SlideShowContext.tsx
 * @description
 * This file defines the **single, unified SlideShow context and provider** that powers slideshow behavior
 * in both read-only (RO) and read/write (RW) canvases. The provider centralizes all slideshow lifecycle
 * concerns: (1) resolving the “selection-based” deck from the current node selection through
 * `useOrderedResources()`; (2) accepting an explicit, immutable override deck via `openCustom()` that
 * callers can supply to run ad-hoc or session-derived slideshows; (3) coordinating a robust state
 * machine that launches study sessions (revision or lesson blocks) only after all dependencies are ready
 * (document readiness from YDoc, user data readiness from UserData, and correct file focus); (4) exposing
 * a stable, documented API for consumers (`open`, `openCustom`, `resetToSelection`, `openSelectedSlides`,
 * `gotoPrev`, `gotoNext`, `close`) while remaining compatible with previous RO and RW call sites; and
 * (5) mounting the canonical slideshow overlay one time under this provider to ensure consistent portal
 * lifecycles. Purposeful console logs (codes 5411–6036 and 7001–7022) trace critical transitions—render
 * readiness, session launch phases, and navigation—without noise. All per-interaction operations are O(1),
 * while reconciliation or synchronization work over slide arrays executes in O(N) when strictly necessary.
 *
 * Responsibilities:
 *  1) Provide a single `SlideShowProvider` that replaces RO and RW variants.
 *  2) Resolve slides from selection (default) or caller overrides (custom).
 *  3) Expose a consistent API: `slides`, `isOpen`, `currentIndex/currentSlide`, `open`, `openCustom`,
 *     `resetToSelection`, `openSelectedSlides`, `gotoNext/gotoPrev`, `close`, and session launch helpers.
 *  4) Synchronize override slides with ResourceContext edits in O(N) only when override mode is active.
 *  5) Coordinate a dependency-aware session launch state machine with clear, recoverable phases.
 *  6) Mount the unified SlideShowOverlay exactly once below the provider.
 */

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
  useCallback,
  useEffect,
} from 'react';
import type { ResourceCard } from '@/app/Library/Definitions/Definitions';
import { useOrderedResources } from '@/app/studygraph/(studygraph)/components/hooks/useOrderedResources';
import SlideShowOverlay from '@/app/studygraph/(studygraph)/components/layout/Canvas/ReadWriteCanvas/Overlays/SlideShowOverlay';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { StudySession } from '@/app/Library/Definitions/CalendarDefinitions';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useUserData } from '@/app/Library/Context/UserDataContext';
import { useBlockStudySession } from '@/app/studygraph/(studygraph)/components/hooks/calendar/useBlockStudySession';
import { getLastViewedSlide, setLastViewedSlide, cachetype } from '@/app/studygraph/(studygraph)/services/localCacheStore';


interface SlideShowContextValue {
  // Active slides (selection-based or override)
  slides: ResourceCard[];
  // Overlay visibility
  isOpen: boolean;
  // Current index & slide
  currentIndex: number;
  currentSlide: ResourceCard | null;

  // Selection-based open: resourceId refers to a resource (default) or a nodeId when nodeId=true
  open: (resourceId: string, nodeId?: boolean) => void;

  // Close and clear override
  close: () => void;

  // Navigation
  gotoNext: () => void;
  gotoPrev: () => void;

  // Override deck management
  openCustom: (slidesToShow: ResourceCard[], cachetype?:cachetype, resumeSlide?:boolean) => void;
  resetToSelection: () => void;

  // Convenience: open the currently resolved slides from selection
  openSelectedSlides: () => void;

  // Study-session launching
  requestSessionLaunch: (request: SessionLaunchRequest) => void;
  sessionLaunchState: SessionLaunchState;
}

interface SessionLaunchRequest {
  sessionId: string;
  sessionData: StudySession;
  targetFileId: string;
}

type SessionLaunchState =
  | { type: 'IDLE' }
  | { type: 'REQUESTED'; request: SessionLaunchRequest }
  | { type: 'SWITCHING_FILE'; request: SessionLaunchRequest; targetFileId: string }
  | { type: 'LOADING_DOCUMENT'; request: SessionLaunchRequest; targetFileId: string }
  | { type: 'LOADING_USERDATA'; request: SessionLaunchRequest; targetFileId: string }
  | { type: 'READY_TO_LAUNCH'; request: SessionLaunchRequest }
  | { type: 'LAUNCHING'; request: SessionLaunchRequest }
  | { type: 'ERROR'; error: string };

const SlideShowContext = createContext<SlideShowContextValue | undefined>(undefined);


/**
 * @function SlideShowProvider
 * @description
 * Provides the unified slideshow state and behaviors to all children. Steps:
 * 1) Read the default selection-based slides (`useOrderedResources()`).
 * 2) Maintain an optional `overrideSlides` that takes precedence when set.
 * 3) Track overlay visibility & current index; compute current slide cheaply.
 * 4) Synchronize override slides with ResourceContext when edits occur—O(N) and only when active.
 * 5) Implement a robust session launch state machine that waits for YDoc render readiness and user
 *    data to be ready before generating and opening a session (block or revision). Errors reset safely.
 * The provider also mounts the single canonical SlideShowOverlay under the tree.
 */
export const SlideShowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Default slides from current node selection
  const defaultSlides = useOrderedResources();

  // Resource helpers (for override synchronization and node->resources resolution)
  const { selectResources, getResourceCard, resources } = useResourceContext();

  // Override deck, visibility, and index
  const [overrideSlides, setOverrideSlides] = useState<ResourceCard[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [lastSessionType,setLastSessionType] = useState<cachetype>("start");
  const [currentIndex, setCurrentIndex] = useState(0);

  // Study-session state machine
  const [sessionLaunchState, setSessionLaunchState] = useState<SessionLaunchState>({ type: 'IDLE' });

  // Cross-context dependencies for document & user data readiness
  const { docFileID , renderReady} = useYDoc();
  const { userRevisionData, loading: userDataLoading, generateRevision, currentDocId } = useUserData();
  const { generateBlockSession } = useBlockStudySession();


  // Alias retained for legacy logs & guards
  const ydocReady = renderReady;

  // Compute active slides (override takes precedence)
  const slides = overrideSlides !== null ? overrideSlides : defaultSlides;


  /**
 * @function resumeIndexFor (new)
 * @description
 *   Given a slide array and a docId, attempt to locate the index of the previously
 *   viewed slide. O(1) to read last id + O(N) worst-case to scan the provided slides.
 *
 *   Steps:
 *    1) Guard: require docFileID; read lastViewedSlideId (O(1)).
 *    2) If none, return 0 (default start).
 *    3) Scan slides for matching id; if found return index; else return 0.
 */
const resumeIndexFor = useCallback((arr: ResourceCard[], cachetype?:cachetype): number => {
  // 1) Read last id (doc-bound)
  if (!docFileID) return 0;
  const lastId = getLastViewedSlide(docFileID, cachetype);
  // 2) No persisted id → start at 0
  if (!lastId) return 0;
  // 3) Find in current deck (O(N) only on open)
  const found = arr.findIndex(s => s.id === lastId);
  return found >= 0 ? found : 0;
}, [docFileID]);


  /**
 * @function persistLastSlide (new)
 * @description
 *   Write the current slide ID into the cache for the active document. O(1).
 *
 *   Steps:
 *    1) Guard: require docFileID and slide.
 *    2) Write {docId -> lastViewedSlideId, lastViewedAt} via local cache helper.
 */
const persistLastSlide = useCallback((slide: ResourceCard | null) => {
  //lastSessionType  : start|review
  // 1) Guard
  if (!docFileID || !slide) return;
  // 2) Write
  setLastViewedSlide(docFileID, slide.id, lastSessionType);
}, [docFileID, lastSessionType]);

  /**
   * @function synchronizeOverrideSlides
   * @description
   * Rebuilds the override deck with fresh ResourceContext data while preserving the order.
   * This ensures inline edits are reflected live during a running slideshow without a restart.
   * The pass is O(N) over the override deck and runs only when override mode is active.
   */
  const synchronizeOverrideSlides = useCallback(() => {
    // ('[SlideShowContext.tsx][7001] › synchronizeOverrideSlides called, overrideSlides length:', overrideSlides?.length || 0);

    if (!overrideSlides || overrideSlides.length === 0) {
      // console.log('[SlideShowContext.tsx][7002] › No override slides to synchronize, skipping');
      return;
    }

    const synchronizedSlides: ResourceCard[] = [];
    let foundUpdates = false;

    overrideSlides.forEach((existingSlide) => {
      const fresh = getResourceCard(existingSlide.id);
      if (fresh) {
        synchronizedSlides.push(fresh);
        const changed = JSON.stringify(existingSlide) !== JSON.stringify(fresh);
        if (changed) {
          foundUpdates = true;
          // console.log('[SlideShowContext.tsx][7003] › Slide updated detected for ID:', existingSlide.id);
        }
      } else {
        synchronizedSlides.push(existingSlide);
        // console.log('[SlideShowContext.tsx][7004] › Slide not found in ResourceContext, keeping original:', existingSlide.id);
      }
    });

    if (foundUpdates) {
      // console.log('[SlideShowContext.tsx][7005] › Applying synchronized slides, count:', synchronizedSlides.length);
      setOverrideSlides(synchronizedSlides);
    } else {
      // console.log('[SlideShowContext.tsx][7006] › No changes detected, override slides remain current');
    }
  }, [overrideSlides, getResourceCard]);

  // React to ResourceContext changes only when override is active
  useEffect(() => {
    // console.log('[SlideShowContext.tsx][7007] › ResourceContext change detected, checking synchronization needs');
    if (overrideSlides && overrideSlides.length > 0) {
      // console.log('[SlideShowContext.tsx][7008] › Override mode active, triggering synchronization');
      synchronizeOverrideSlides();
    } else {
      // console.log('[SlideShowContext.tsx][7009] › Default mode active, no synchronization needed');
    }
  }, [overrideSlides, resources, synchronizeOverrideSlides]);

/**
 * @function open
 * @description
 *   Opens slideshow targeting a resource or a node’s first resource. Now resumes
 *   when default deck is used; override path remains unchanged.                  // update - 3
 *
 *   Steps:
 *    1) Resolve target index in current slides (resource or node).
 *    2) If node not in selection, create merged override and start at 0.
 *    3) Otherwise set index to found idx (no resume needed because explicit target),
 *       and open.
 *    4) When resourceId is not found and not node, fall back to resume on default.
 */
const open = useCallback(                                                       // update - 3
  (resourceId: string, nodeId: boolean = false) => {
    // console.log('[SlideShowContext.tsx][7010] › Opening slideshow for resource:', resourceId, 'nodeId mode:', nodeId);
    let idx: number = -1;

    if (nodeId) {
      const resourceCards = selectResources(resourceId);
      if (resourceCards.length === 0) {
        // console.log('[SlideShowContext.tsx][7011] › No resources found for node:', resourceId);
        return;
      }
      idx = slides.findIndex((r) => r.id === resourceCards[0].id);
      if (idx < 0) {
        const merged = [...resourceCards, ...defaultSlides];
        // console.log('[SlideShowContext.tsx][7012] › Switching to override mode with merged slides, count:', merged.length);
        setOverrideSlides(merged);
        setCurrentIndex(0);
        setIsOpen(true);
        return;
      }
    } else {
      idx = slides.findIndex((r) => r.id === resourceId);
    }

    if (idx >= 0) {
      // console.log('[SlideShowContext.tsx][7013] › Found slide at index:', idx);
      setCurrentIndex(idx);
      setIsOpen(true);
    } else {
      // 4) Fallback: open current resolved slides using resume index
      if (slides.length > 0) {
        // console.log('[SlideShowContext.tsx][7013.1] › Target not found; falling back to resume index'); // update - 3
        const start = resumeIndexFor(slides);                                   // update - 3
        setCurrentIndex(start);
        setIsOpen(true);
      } else {
        // console.log('[SlideShowContext.tsx][7014] › Slide not found in current slides');
      }
    }
  },
  [slides, defaultSlides, selectResources, resumeIndexFor]                      // update - 3
);

  



  /**
   * @function openSelectedSlides
   * @description
   * Opens the slideshow with the current resolved deck (selection or override) starting from index 0.
   * This is an O(1) operation that simply flips visibility and resets the index to the first slide.
   */
  const openSelectedSlides = useCallback(() => {
    // console.log('[SlideShowContext.tsx][7015] › Opening selected slides, count:', slides.length);
    if (slides.length > 0) {
      setCurrentIndex(0);
      setIsOpen(true);
    }
  }, [slides]);

/**
 * @function openCustom
 * @description
 *   Replaces the deck with caller-provided slides and opens the overlay.
 *   Now attempts to resume from last-viewed slide for the active doc.  // update - 1
 *
 *   Steps:
 *    1) Set override slides.
 *    2) If there are slides: compute start index via resumeIndexFor(arr).
 *    3) Set index and open.
 */
const openCustom = useCallback((slidesToShow: ResourceCard[], cachetype?:cachetype, resumeSlide = true) => {              // update - 1
  // console.log('[SlideShowContext.tsx][7016] › Opening custom slideshow with slides, count:', slidesToShow.length);
  setOverrideSlides(slidesToShow);
  if (slidesToShow.length > 0 && resumeSlide && cachetype) {
    setLastSessionType(cachetype);
    // 2) compute resume index
    const start = resumeIndexFor(slidesToShow, cachetype);                                 // update - 1
    setCurrentIndex(start);
    setIsOpen(true);
  }
  else if (slidesToShow.length > 0 && !resumeSlide) {
    const start = 0;                                 // update - 1
    setCurrentIndex(start);
    setIsOpen(true);
  }
}, [resumeIndexFor]);  
  /**
   * @function resetToSelection
   * @description
   * Clears the override deck so that the next `open()` call uses the selection-based deck again.
   * This is O(1) and does not affect the default selection list.
   */
  const resetToSelection = useCallback(() => {
    // console.log('[SlideShowContext.tsx][7017] › Resetting to selection-based mode');
    setOverrideSlides(null);
  }, []);

                        // update - 6


/**
 * @function gotoNext
 * @description
 *   Move forward one slide (clamped). Persist last slide after computing next.   // update - 4
 *
 *   Steps:
 *    1) Compute next index (clamped).
 *    2) Persist next slide id (if any).
 *    3) Set current index.
 */
const gotoNext = useCallback(() => {                                            // update - 4
  const next = Math.min(currentIndex + 1, slides.length - 1);                   // 1
  const nextSlide = slides[next];                                               // 2
  if (nextSlide) persistLastSlide(nextSlide);                                   // update - 4
  // console.log('[SlideShowContext.tsx][7019] › Going to next slide, index:', currentIndex, '->', next);
  setCurrentIndex(next);                                                        // 3
}, [currentIndex, slides, persistLastSlide]);                                   // update - 4

/**
 * @function gotoPrev
 * @description
 *   Move backward one slide (clamped). Persist last slide after computing prev.  // update - 5
 *
 *   Steps:
 *    1) Compute prev index (clamped).
 *    2) Persist prev slide id (if any).
 *    3) Set current index.
 */
const gotoPrev = useCallback(() => {                                            // update - 5
  const prev = Math.max(currentIndex - 1, 0);                                   // 1
  const prevSlide = slides[prev];                                               // 2
  if (prevSlide) persistLastSlide(prevSlide);                                   // update - 5
  // console.log('[SlideShowContext.tsx][7020] › Going to previous slide, index:', currentIndex, '->', prev);
  setCurrentIndex(prev);                                                        // 3
}, [currentIndex, slides, persistLastSlide]);                                   // update - 5


  /**
   * @function currentSlide
   * @description
   * Returns the slide at the current index or null if out-of-bounds. O(1).
   */
  const currentSlide = useMemo(() => {
    const slide = slides[currentIndex] || null;
    // console.log('[SlideShowContext.tsx][7021] › Current slide computed:', slide?.id || 'null');
    return slide;
  }, [slides, currentIndex]);

  /**
   * @function requestSessionLaunch
   * @description
   * Enqueues a session launch request (revision or block). The state machine ensures all dependencies
   * are ready before generating the deck and opening the slideshow. O(1) enqueue.
   */
  const requestSessionLaunch = useCallback((request: SessionLaunchRequest) => {
    // console.log('[SlideShowContext.tsx][7022] › Session launch requested:', request.sessionId);
    setSessionLaunchState({ type: 'REQUESTED', request });
  }, []);

  // Session launch state machine
  useEffect(() => {
    const handleState = async () => {
      try {
        switch (sessionLaunchState.type) {
          case 'REQUESTED': {
            // console.log('[SlideShowContext.tsx][6019] › Processing session launch request for:', sessionLaunchState.request.sessionId);
            const targetFileId = sessionLaunchState.request.targetFileId;
            if (docFileID !== targetFileId) {
              // console.log('[SlideShowContext.tsx][6020] › File switch required from', docFileID, 'to', targetFileId);
              setSessionLaunchState({ type: 'SWITCHING_FILE', request: sessionLaunchState.request, targetFileId });
            } else {
              // console.log('[SlideShowContext.tsx][6021] › Same file, proceeding to document verification');
              setSessionLaunchState({ type: 'LOADING_DOCUMENT', request: sessionLaunchState.request, targetFileId });
            }
            break;
          }
          case 'SWITCHING_FILE': {
            if (docFileID === sessionLaunchState.targetFileId) {
              // console.log('[SlideShowContext.tsx][6022] › File switch completed successfully');
              setSessionLaunchState({
                type: 'LOADING_DOCUMENT',
                request: sessionLaunchState.request,
                targetFileId: sessionLaunchState.targetFileId,
              });
            } else {
              // console.log('[SlideShowContext.tsx][6023] › Waiting for file switch completion... current:', docFileID, 'target:', sessionLaunchState.targetFileId);
            }
            break;
          }
          case 'LOADING_DOCUMENT': {
            const ready = docFileID === sessionLaunchState.targetFileId && ydocReady;
            if (ready) {
              // console.log('[SlideShowContext.tsx][6024] › Document ready, proceeding to user data verification');
              setSessionLaunchState({
                type: 'LOADING_USERDATA',
                request: sessionLaunchState.request,
                targetFileId: sessionLaunchState.targetFileId,
              });
            } else {
              // console.log('[SlideShowContext.tsx][6025] › Waiting for document readiness... fileMatch:', docFileID === sessionLaunchState.targetFileId, 'ydocReady:', ydocReady);
            }
            break;
          }
          case 'LOADING_USERDATA': {
            const ok =
              docFileID === sessionLaunchState.targetFileId &&
              !userDataLoading &&
              currentDocId === sessionLaunchState.targetFileId &&
              userRevisionData !== null;

            if (ok) {
              // console.log('[SlideShowContext.tsx][6026] › UserData ready, preparing for session launch');
              setSessionLaunchState({ type: 'READY_TO_LAUNCH', request: sessionLaunchState.request });
            } 
            break;
          }
          case 'READY_TO_LAUNCH': {
            // console.log('[SlideShowContext.tsx][6028] › All dependencies ready, launching session');
            setSessionLaunchState({ type: 'LAUNCHING', request: sessionLaunchState.request });

            const { request } = sessionLaunchState;
            let generatedSlides: ResourceCard[] = [];
            let isNotInterleaveSession = true;

            if (request.sessionData.type === 'block') {
              // console.log('[SlideShowContext.tsx][6029] › Generating block session with', request.sessionData.targetLessonUnits.length, 'units');
              if (!request.sessionData.targetLessonUnits || request.sessionData.targetLessonUnits.length === 0) {
                throw new Error('No lesson units provided for block session');
              }
              generatedSlides = generateBlockSession(request.sessionData.targetLessonUnits);
              // console.log('[SlideShowContext.tsx][6030] › Generated', generatedSlides.length, 'block session slides');
            }
            else if (request.sessionData.type === 'revision-block'){
                
              // console.log('[SlideShowContext.tsx][6029] › Generating block session with', request.sessionData.targetLessonUnits.length, 'units');
              if (!request.sessionData.targetLessonUnits || request.sessionData.targetLessonUnits.length === 0) {
                throw new Error('No lesson units provided for block session');
              }
              const revision = generateBlockSession(request.sessionData.targetLessonUnits);
              generatedSlides = revision.filter(card => card.type !== 'note');
              // console.log('[SlideShowContext.tsx][6030] › Generated', generatedSlides.length, 'block session slides');
            
            }
            else {
              // console.log('[SlideShowContext.tsx][6031] › Generating revision session');
              const revision = generateRevision();
              isNotInterleaveSession = false;
              if (revision) {
                generatedSlides = [...revision.flashCards, ...revision.quizzes];
                // console.log('[SlideShowContext.tsx][6032] › Generated', generatedSlides.length, 'revision slides');
              } else {
                throw new Error('Failed to generate revision content - generateRevision returned null');
              }
            }

            if (generatedSlides.length === 0) {
              throw new Error('No slides generated for session - empty content collection');
            }
            let key = "session" + request.sessionId
            openCustom(generatedSlides, key,isNotInterleaveSession);
            // console.log('[SlideShowContext.tsx][6033] › Session launched successfully with', generatedSlides.length, 'slides');
            setSessionLaunchState({ type: 'IDLE' });
            break;
          }
          case 'ERROR': {
            console.error('[SlideShowContext.tsx][6034] › Session launch error:', sessionLaunchState.error);
            setTimeout(() => {
              // console.log('[SlideShowContext.tsx][6035] › Resetting state machine after error');
              setSessionLaunchState({ type: 'IDLE' });
            }, 5000);
            break;
          }
        }
      } catch (err) {
        console.error('[SlideShowContext.tsx][6036] › State machine error:', err);
        setSessionLaunchState({
          type: 'ERROR',
          error: err instanceof Error ? err.message : 'Unknown state machine error',
        });
      }
    };

    if (sessionLaunchState.type !== 'IDLE') {
      handleState();
    }
  }, [
    sessionLaunchState,
    docFileID,
    ydocReady,
    userDataLoading,
    userRevisionData,
    currentDocId,
    generateBlockSession,
    generateRevision,
    openCustom,
  ]);


  /**
 * @function close
 * @description
 *   Close overlay and clear override. Persist the current slide before closing.  // update - 6
 *
 *   Steps:
 *    1) Persist current slide (if any).
 *    2) Close overlay (isOpen=false).
 *    3) Reset to selection to avoid stale overrides.
 */
const close = useCallback(() => {                                               // update - 6
  // 1) Persist current slide on exit
  persistLastSlide(currentSlide);                                               // update - 6
  // console.log('[SlideShowContext.tsx][7018] › Closing slideshow and clearing overrides');
  // 2) Close
  setIsOpen(false);
  // 3) Clear override
  resetToSelection();
}, [resetToSelection, currentSlide, persistLastSlide]);  



/**
 * @effect Persist whenever the computed currentSlide changes while the overlay is open. (new)
 * @description
 *   This makes persistence robust even if navigation is triggered externally.
 *
 *   Steps:
 *    1) When isOpen && currentSlide change, write to cache (O(1)).
 */
useEffect(() => {
  if (!isOpen) return;
  persistLastSlide(currentSlide);
}, [isOpen, currentSlide, persistLastSlide]);




  const value = useMemo(
    () => ({
      slides,
      isOpen,
      currentIndex,
      currentSlide,
      open,
      close,
      gotoNext,
      gotoPrev,
      openCustom,
      resetToSelection,
      openSelectedSlides,
      requestSessionLaunch,
      sessionLaunchState,
    }),
    [
      slides,
      isOpen,
      currentIndex,
      currentSlide,
      open,
      close,
      gotoNext,
      gotoPrev,
      openCustom,
      resetToSelection,
      openSelectedSlides,
      requestSessionLaunch,
      sessionLaunchState,
    ]
  );

  return (
    <SlideShowContext.Provider value={value}>
      {children}
      {/* The unified overlay is mounted once under the provider to avoid portal churn. */}
      <SlideShowOverlay />
    </SlideShowContext.Provider>
  );
};

/**
 * @function useSlideShow
 * @description
 * Accessor hook for the unified slideshow context. It throws an explicit error if used without the
 * provider to prevent undefined behavior and aid debugging. O(1).
 */
export function useSlideShow(): SlideShowContextValue {
  const ctx = useContext(SlideShowContext);
  if (!ctx) throw new Error('useSlideShow must be used within a SlideShowProvider');
  return ctx;
}
