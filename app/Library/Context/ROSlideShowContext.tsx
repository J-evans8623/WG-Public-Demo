// File: src/app/Library/Context/SlideShowContext.tsx
/**
 * @file ROSlideShowContext.tsx  (read only)
 * @description
 *   Provides a context for managing the slideshow overlay. In addition to
 *   the existing “selection-based” behavior (where slides come from 
 *   useOrderedResources()), we now allow callers to supply an explicit list
 *   of ResourceCard objects via openCustom(...). When an override list is set,
 *   the slideshow will render exactly that list; otherwise, it falls back to
 *   the default node-selection-driven array from useOrderedResources().
 *
 *   RESPONSIBILITIES:
 *     - Maintain `overrideSlides` (ResourceCard[] | null). When non-null, slides
 *       are taken from this override. When null, slides come from useOrderedResources().
 *     - Expose `open(resourceId)` for selection-based opening (existing behavior).
 *     - Expose `openCustom(slidesToShow: ResourceCard[])` for override mode.
 *     - Expose `resetToSelection()` to clear any override, returning to default behavior.
 *     - Ensure that `close()` always clears overrideSlides to avoid stale state.
 *     - Provide currentSlide, currentIndex, gotoNext, gotoPrev, isOpen, and slides list.
 */

import React, { createContext, useContext, useMemo, useState, ReactNode, useCallback, useEffect } from 'react';
import type { ResourceCard } from '@/app/Library/Definitions/Definitions';
import { useOrderedResources } from '@/app/studygraph/(studygraph)/components/hooks/useOrderedResources';
import SlideShowOverlay from '@/app/studygraph/(studygraph)/components/layout/CardDisplay/Cards/ROSlideShowOverlay';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { PickerFileMeta, StudySession } from '../Definitions/CalendarDefinitions';
import { useYDoc } from './YDocContext';
import { useUserData } from './UserDataContext';
import { useBlockStudySession } from '@/app/studygraph/(studygraph)/components/hooks/calendar/useBlockStudySession';

interface SlideShowContextValue {
  // The array of slides currently being displayed (override or ordered resources)
  slides: ResourceCard[];
  // Whether the overlay is open
  isOpen: boolean;
  // Index of the current slide in `slides`
  currentIndex: number;
  // The currently displayed slide (or null if index is out of range)
  currentSlide: ResourceCard | null;
  // Default mode: open slideshow at a particular resource (selection-based)
  open: (resourceId: string, nodeId?:boolean) => void;
  // Close the slideshow (also resets any override)
  close: () => void;
  // Advance to next slide
  gotoNext: () => void;
  // Go back to previous slide
  gotoPrev: () => void;

  // ******** New Methods (Override Mode) ********
  // Override mode: open slideshow with exactly the provided array of ResourceCard
  openCustom: (slidesToShow: ResourceCard[]) => void;
  // Clear any override, returning to default node-selection-driven mode
  resetToSelection: () => void;

  openSelectedSlides : () => void;

  requestSessionLaunch: (request: SessionLaunchRequest) => void;
  sessionLaunchState: SessionLaunchState
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
  | { type: 'LOADING_DOCUMENT'; request: SessionLaunchRequest; targetFileId: string }  // Skip SWITCHING_FILE
  | { type: 'LOADING_USERDATA'; request: SessionLaunchRequest; targetFileId: string }
  | { type: 'READY_TO_LAUNCH'; request: SessionLaunchRequest }
  | { type: 'LAUNCHING'; request: SessionLaunchRequest }
  | { type: 'ERROR'; error: string };


const SlideShowContext = createContext<SlideShowContextValue | undefined>(undefined);

export const SlideShowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Default slides come from the current node selection via useOrderedResources()
  const defaultSlides = useOrderedResources();
  const {selectResources} = useResourceContext();
   const { currentDocId } = useUserData(); // Add this to the hook return

  // When overrideSlides is non-null, we use it; otherwise, fall back to defaultSlides
  const [overrideSlides, setOverrideSlides] = useState<ResourceCard[] | null>(null);
  let slides = overrideSlides !== null ? overrideSlides : defaultSlides;

  // Track whether the overlay is open and the current index into `slides`
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionLaunchState, setSessionLaunchState] = useState<SessionLaunchState>({ type: 'IDLE' });
  // Access dependency contexts
  const { docFileID, isInitialized: ydocReady } = useYDoc();
  const { userRevisionData, loading: userDataLoading ,  generateRevision } = useUserData();
  const { generateBlockSession } = useBlockStudySession();
 

  // === Default “selection-based” open ===
const open = useCallback(
    (resourceId: string, nodeId: boolean = false) => {
      let idx: number = -1;

      if (nodeId) {
        const resourceCards = selectResources(resourceId);
        if (resourceCards.length === 0) return;

        // Try to find the first resource from that node in current slides
        idx = slides.findIndex((r) => r.id === resourceCards[0].id);

        if (idx < 0) {
          // Not present in current/default slides; switch to override mode so we can include it
          // Prepend the node's resources, then the default selection-based list
          const merged = [...resourceCards, ...defaultSlides];
          setOverrideSlides(merged);
          setCurrentIndex(0);
          setIsOpen(true);
          return;
        }
      } else {
        // resourceId refers directly to a resource
        idx = slides.findIndex((r) => r.id === resourceId);
      }

      if (idx >= 0) {
        setCurrentIndex(idx);
        setIsOpen(true);
      }
    },
    [slides, defaultSlides, selectResources]
  );


  const openSelectedSlides = useCallback (() => {
    if (slides.length > 0 ) {
        setCurrentIndex(0);
        setIsOpen(true);
    }
  }, [slides])
  // === Override methods ===

  const openCustom = useCallback((slidesToShow: ResourceCard[]) => {
    // Replace the slides array with the caller's list, start at index 0, and open
    setOverrideSlides(slidesToShow);
    if (slidesToShow.length > 0) {
      setCurrentIndex(0);
      setIsOpen(true);
    }
  }, []);

  const resetToSelection = () => {
    // Clear override slides so next open uses defaultSlides again
    setOverrideSlides(null);
  };

  // === Close should clear override ===
  const close = useCallback(() => {
    setIsOpen(false);
    resetToSelection();
  }, [])

  // === Navigation helpers ===
  const gotoNext = useCallback(() => setCurrentIndex(i => Math.min(i + 1, slides.length - 1)), [slides.length]);
  const gotoPrev = () => setCurrentIndex(i => Math.max(i - 1, 0));

  // Compute currentSlide once per relevant state change
  const currentSlide = useMemo(() => {
    return slides[currentIndex] || null;
  }, [slides, currentIndex]);


   const requestSessionLaunch = useCallback((request: SessionLaunchRequest) => {
    console.log('[SlideShow] Session launch requested:', request.sessionId);
    setSessionLaunchState({ type: 'REQUESTED', request });
  }, []);

  // Simplified state machine (no file switching logic)
/**
   * Enhanced session launch state machine with comprehensive dependency coordination.
   * Handles file switching, document loading, user data initialization, and content
   * generation with proper error handling and recovery mechanisms throughout.
   */
  useEffect(() => {
    const handleStateTransition = async () => {
      try {
        switch (sessionLaunchState.type) {
          case 'REQUESTED': {
            console.log('[SlideShowContext.tsx][6019] › Processing session launch request for:', sessionLaunchState.request.sessionId);
            const targetFileId = sessionLaunchState.request.targetFileId;
            
            // Step 1: Check if file switching is required
            if (docFileID !== targetFileId) {
              console.log('[SlideShowContext.tsx][6020] › File switch required from', docFileID, 'to', targetFileId);
              setSessionLaunchState({ 
                type: 'SWITCHING_FILE', 
                request: sessionLaunchState.request,
                targetFileId 
              });
            } else {
              console.log('[SlideShowContext.tsx][6021] › Same file, proceeding to document verification');
              setSessionLaunchState({ 
                type: 'LOADING_DOCUMENT', 
                request: sessionLaunchState.request,
                targetFileId 
              });
            }
            break;
          }

          case 'SWITCHING_FILE': {
            // Step 2: Wait for file switch completion with timeout protection
            if (docFileID === sessionLaunchState.targetFileId) {
              console.log('[SlideShowContext.tsx][6022] › File switch completed successfully');
              setSessionLaunchState({ 
                type: 'LOADING_DOCUMENT', 
                request: sessionLaunchState.request,
                targetFileId: sessionLaunchState.targetFileId
              });
            } else {
              console.log('[SlideShowContext.tsx][6023] › Waiting for file switch completion... current:', docFileID, 'target:', sessionLaunchState.targetFileId);
            }
            break;
          }

          case 'LOADING_DOCUMENT': {
            // Step 3: Verify document readiness with comprehensive checks
            const isDocumentReady = docFileID === sessionLaunchState.targetFileId && ydocReady;
            
            if (isDocumentReady) {
              console.log('[SlideShowContext.tsx][6024] › Document ready, proceeding to user data verification');
              setSessionLaunchState({ 
                type: 'LOADING_USERDATA', 
                request: sessionLaunchState.request,
                targetFileId: sessionLaunchState.targetFileId
              });
            } else {
              console.log('[SlideShowContext.tsx][6025] › Waiting for document readiness... fileMatch:', 
                docFileID === sessionLaunchState.targetFileId, 'ydocReady:', ydocReady);
            }
            break;
          }

          case 'LOADING_USERDATA': {
            // Step 4: Ensure UserData is properly loaded and synchronized
            const isUserDataReady = docFileID === sessionLaunchState.targetFileId && 
                                   !userDataLoading && 
                                   currentDocId === sessionLaunchState.targetFileId &&
                                   userRevisionData !== null;
            
            if (isUserDataReady) {
              console.log('[SlideShowContext.tsx][6026] › UserData ready, preparing for session launch');
              setSessionLaunchState({ 
                type: 'READY_TO_LAUNCH', 
                request: sessionLaunchState.request 
              });
            } else {
              console.log('[SlideShowContext.tsx][6027] › Waiting for UserData readiness... fileMatch:', 
                docFileID === sessionLaunchState.targetFileId,
                'userDataFileMatch:', currentDocId === sessionLaunchState.targetFileId,
                'loading:', userDataLoading, 
                'hasData:', !!userRevisionData);
            }
            break;
          }

          case 'READY_TO_LAUNCH': {
            console.log('[SlideShowContext.tsx][6028] › All dependencies ready, launching session');
            setSessionLaunchState({ type: 'LAUNCHING', request: sessionLaunchState.request });
            
            // Step 5: Generate session content based on session type
            const { request } = sessionLaunchState;
            let generatedSlides: ResourceCard[] = [];
            
            if (request.sessionData.type === 'block') {
              // Generate block session slides with validation
              console.log('[SlideShowContext.tsx][6029] › Generating block session with', request.sessionData.targetLessonUnits.length, 'units');
              
              if (!request.sessionData.targetLessonUnits || request.sessionData.targetLessonUnits.length === 0) {
                throw new Error('No lesson units provided for block session');
              }
              
              generatedSlides = generateBlockSession(request.sessionData.targetLessonUnits);
              console.log('[SlideShowContext.tsx][6030] › Generated', generatedSlides.length, 'block session slides');
              
            } else {
              // Generate revision slides with validation
              console.log('[SlideShowContext.tsx][6031] › Generating revision session');
              const revision = generateRevision();
              
              if (revision) {
                generatedSlides = [...revision.flashCards, ...revision.quizzes];
                console.log('[SlideShowContext.tsx][6032] › Generated', generatedSlides.length, 'revision slides');
              } else {
                throw new Error('Failed to generate revision content - generateRevision returned null');
              }
            }

            // Step 6: Validate generated content and launch slideshow
            if (generatedSlides.length === 0) {
              throw new Error('No slides generated for session - empty content collection');
            }

            // Launch the slideshow with generated content
            openCustom(generatedSlides);
            console.log('[SlideShowContext.tsx][6033] › Session launched successfully with', generatedSlides.length, 'slides');

            // Reset state machine to idle
            setSessionLaunchState({ type: 'IDLE' });
            break;
          }

          case 'ERROR': {
            console.error('[SlideShowContext.tsx][6034] › Session launch error:', sessionLaunchState.error);
            
            // Step 7: Auto-reset after error display with user feedback
            setTimeout(() => {
              console.log('[SlideShowContext.tsx][6035] › Resetting state machine after error');
              setSessionLaunchState({ type: 'IDLE' });
            }, 5000);
            break;
          }
        }
      } catch (error) {
        console.error('[SlideShowContext.tsx][6036] › State machine error:', error);
        setSessionLaunchState({ 
          type: 'ERROR', 
          error: error instanceof Error ? error.message : 'Unknown state machine error'
        });
      }
    };

    // Only run state machine when not idle
    if (sessionLaunchState.type !== 'IDLE') {
      handleStateTransition();
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
    openCustom
  ]);


  // Memoize context value object
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
      sessionLaunchState
    }),
    [slides, isOpen, currentIndex, currentSlide, open, close, gotoNext, openCustom, openSelectedSlides, requestSessionLaunch, sessionLaunchState]
  );

  return (
    <SlideShowContext.Provider value={value}>
      {children}
      {/* Always mount the overlay so it can react to context state */}
      <SlideShowOverlay />
    </SlideShowContext.Provider>
  );
};

export function useSlideShow(): SlideShowContextValue {
  const ctx = useContext(SlideShowContext);
  if (!ctx) throw new Error('useSlideShow must be used within a SlideShowProvider');
  return ctx;
}
