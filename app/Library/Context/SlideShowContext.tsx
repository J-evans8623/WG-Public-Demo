// SlideShowContext.tsx

// File: src/app/Library/Context/SlideShowContext.tsx
/**
 * @file SlideShowContext.tsx
 * @description
 *   Provides a context for managing the slideshow overlay with real-time synchronization capabilities.
 *   In addition to the existing "selection-based" behavior (where slides come from useOrderedResources()),
 *   we now allow callers to supply an explicit list of ResourceCard objects via openCustom(...).
 *   The context implements intelligent override synchronization that ensures edited slides are immediately
 *   reflected in the slideshow without breaking existing auto-advance behaviors from AI services.
 *   When an override list is set, the slideshow will render exactly that list with real-time updates;
 *   otherwise, it falls back to the default node-selection-driven array from useOrderedResources().
 *   The synchronization system monitors ResourceContext changes and rebuilds override slides dynamically
 *   while preserving slide order and current position, ensuring users see their edits immediately.
 *
 *   RESPONSIBILITIES:
 *     - Maintain `overrideSlides` (ResourceCard[] | null) with real-time synchronization to ResourceContext
 *     - Implement override slide synchronization that preserves order and current position during updates
 *     - Expose `open(resourceId)` for selection-based opening (existing behavior)
 *     - Expose `openCustom(slidesToShow: ResourceCard[])` for override mode with live updates
 *     - Expose `resetToSelection()` to clear any override, returning to default behavior
 *     - Ensure that `close()` always clears overrideSlides to avoid stale state
 *     - Provide currentSlide, currentIndex, gotoNext, gotoPrev, isOpen, and slides list with live data
 *     - Coordinate session launch state machine for study sessions and revision modes
 *     - Monitor and log critical synchronization events for debugging and observability
 */

import React, { createContext, useContext, useMemo, useState, ReactNode, useCallback, useEffect } from 'react';
import type { ResourceCard } from '@/app/Library/Definitions/Definitions';
import { useOrderedResources } from '@/app/studygraph/(studygraph)/components/hooks/useOrderedResources';
import SlideShowOverlay from '@/app/studygraph/(studygraph)/components/layout/CardDisplay/Cards/SlideShowOverlay';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { PickerFileMeta, StudySession, LessonUnit } from '../Definitions/CalendarDefinitions';
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

  // ******** Override Mode Methods ********
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
  const {selectResources, getResourceCard, resources} = useResourceContext();
  const { currentDocId } = useUserData();

  // When overrideSlides is non-null, we use it; otherwise, fall back to defaultSlides
  const [overrideSlides, setOverrideSlides] = useState<ResourceCard[] | null>(null);
  
  // Track whether the overlay is open and the current index into `slides`
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionLaunchState, setSessionLaunchState] = useState<SessionLaunchState>({ type: 'IDLE' });
  
  // Access dependency contexts
  const { docFileID, isInitialized: ydocReady } = useYDoc();
  const { userRevisionData, loading: userDataLoading ,  generateRevision } = useUserData();
  const { generateBlockSession } = useBlockStudySession();

  /**
   * synchronizeOverrideSlides
   * Core synchronization function that rebuilds the override slides array with fresh data
   * from ResourceContext while preserving order and maintaining current slide position.
   * This ensures that any edits made to slides are immediately reflected in the slideshow
   * without disrupting the user experience or breaking auto-advance behaviors.
   * Uses O(n) time complexity for efficient processing of slide arrays.
   */
  const synchronizeOverrideSlides = useCallback(() => {
    console.log('[SlideShowContext.tsx][7001] › synchronizeOverrideSlides called, overrideSlides length:', overrideSlides?.length || 0);
    
    if (!overrideSlides || overrideSlides.length === 0) {
      console.log('[SlideShowContext.tsx][7002] › No override slides to synchronize, skipping');
      return;
    }

    // 1. Rebuild override slides with fresh data from ResourceContext
    const synchronizedSlides: ResourceCard[] = [];
    let foundUpdates = false;

    // 2. Iterate through existing override slides and fetch fresh data
    overrideSlides.forEach((existingSlide, index) => {
      const freshSlide = getResourceCard(existingSlide.id);
      
      if (freshSlide) {
        synchronizedSlides.push(freshSlide);
        
        // 3. Check if this slide has been updated by comparing content
        const hasChanged = JSON.stringify(existingSlide) !== JSON.stringify(freshSlide);
        if (hasChanged) {
          foundUpdates = true;
          console.log('[SlideShowContext.tsx][7003] › Slide updated detected for ID:', existingSlide.id);
        }
      } else {
        // 4. If slide no longer exists, keep the original (fallback behavior)
        synchronizedSlides.push(existingSlide);
        console.log('[SlideShowContext.tsx][7004] › Slide not found in ResourceContext, keeping original:', existingSlide.id);
      }
    });

    // 5. Only update state if we found actual changes (optimization)
    if (foundUpdates) {
      console.log('[SlideShowContext.tsx][7005] › Applying synchronized slides, count:', synchronizedSlides.length);
      setOverrideSlides(synchronizedSlides);
    } else {
      console.log('[SlideShowContext.tsx][7006] › No changes detected, override slides remain current');
    }
  }, [overrideSlides, getResourceCard]);

  /**
   * Real-time Override Synchronization Effect
   * Monitors ResourceContext changes and triggers synchronization when override mode is active.
   * This ensures that slide edits are immediately visible without requiring slideshow restart.
   * The effect uses dependency tracking to minimize unnecessary synchronization calls.
   */
  useEffect(() => {
    console.log('[SlideShowContext.tsx][7007] › ResourceContext change detected, checking synchronization needs');
    
    // Only synchronize when we have override slides active
    if (overrideSlides && overrideSlides.length > 0) {
      console.log('[SlideShowContext.tsx][7008] › Override mode active, triggering synchronization');
      synchronizeOverrideSlides();
    } else {
      console.log('[SlideShowContext.tsx][7009] › Default mode active, no synchronization needed');
    }
  }, [overrideSlides, resources, synchronizeOverrideSlides]); // Watch ResourceContext changes

  // Compute final slides array (override takes precedence)
  let slides = overrideSlides !== null ? overrideSlides : defaultSlides;

  // === Default "selection-based" open ===
const open = useCallback(
    (resourceId: string, nodeId: boolean = false) => {
      console.log('[SlideShowContext.tsx][7010] › Opening slideshow for resource:', resourceId, 'nodeId mode:', nodeId);
      
      let idx: number = -1;

      if (nodeId) {
        const resourceCards = selectResources(resourceId);
        if (resourceCards.length === 0) {
          console.log('[SlideShowContext.tsx][7011] › No resources found for node:', resourceId);
          return;
        }

        // Try to find the first resource from that node in current slides
        idx = slides.findIndex((r) => r.id === resourceCards[0].id);

        if (idx < 0) {
          // Not present in current/default slides; switch to override mode so we can include it
          // Prepend the node's resources, then the default selection-based list
          const merged = [...resourceCards, ...defaultSlides];
          console.log('[SlideShowContext.tsx][7012] › Switching to override mode with merged slides, count:', merged.length);
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
        console.log('[SlideShowContext.tsx][7013] › Found slide at index:', idx);
        setCurrentIndex(idx);
        setIsOpen(true);
      } else {
        console.log('[SlideShowContext.tsx][7014] › Slide not found in current slides');
      }
    },
    [slides, defaultSlides, selectResources]
  );

  const openSelectedSlides = useCallback (() => {
    console.log('[SlideShowContext.tsx][7015] › Opening selected slides, count:', slides.length);
    
    if (slides.length > 0 ) {
        setCurrentIndex(0);
        setIsOpen(true);
    }
  }, [slides])

  // === Override methods ===

  const openCustom = useCallback((slidesToShow: ResourceCard[]) => {
    console.log('[SlideShowContext.tsx][7016] › Opening custom slideshow with slides, count:', slidesToShow.length);
    
    // Replace the slides array with the caller's list, start at index 0, and open
    setOverrideSlides(slidesToShow);
    if (slidesToShow.length > 0) {
      setCurrentIndex(0);
      setIsOpen(true);
    }
  }, []);

  const resetToSelection = useCallback(() => {
    console.log('[SlideShowContext.tsx][7017] › Resetting to selection-based mode');
    
    // Clear override slides so next open uses defaultSlides again
    setOverrideSlides(null);
  }, []);

  // === Close should clear override ===
  const close = useCallback(() => {
    console.log('[SlideShowContext.tsx][7018] › Closing slideshow and clearing overrides');
    
    setIsOpen(false);
    resetToSelection();
  }, [resetToSelection])

  // === Navigation helpers ===
  const gotoNext = useCallback(() => {
    const newIndex = Math.min(currentIndex + 1, slides.length - 1);
    console.log('[SlideShowContext.tsx][7019] › Going to next slide, index:', currentIndex, '->', newIndex);
    setCurrentIndex(newIndex);
  }, [currentIndex, slides.length]);
  
  const gotoPrev = useCallback(() => {
    const newIndex = Math.max(currentIndex - 1, 0);
    console.log('[SlideShowContext.tsx][7020] › Going to previous slide, index:', currentIndex, '->', newIndex);
    setCurrentIndex(newIndex);
  }, [currentIndex]);

  // Compute currentSlide once per relevant state change
  const currentSlide = useMemo(() => {
    const slide = slides[currentIndex] || null;
    console.log('[SlideShowContext.tsx][7021] › Current slide computed:', slide?.id || 'null');
    return slide;
  }, [slides, currentIndex]);

   const requestSessionLaunch = useCallback((request: SessionLaunchRequest) => {
    console.log('[SlideShowContext.tsx][7022] › Session launch requested:', request.sessionId);
    setSessionLaunchState({ type: 'REQUESTED', request });
  }, []);

  /**
   * Enhanced session launch state machine with comprehensive dependency coordination.
   * Handles file switching, document loading, user data initialization, and content
   * generation with proper error handling and recovery mechanisms throughout.
   * This state machine coordinates multiple contexts to ensure all dependencies are
   * ready before launching study sessions, maintaining data consistency and user experience.
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
    [slides, isOpen, currentIndex, currentSlide, open, close, gotoNext, gotoPrev, openCustom, resetToSelection, openSelectedSlides, requestSessionLaunch, sessionLaunchState]
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