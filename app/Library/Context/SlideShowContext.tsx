// File: src/app/Library/Context/SlideShowContext.tsx
/**
 * @file SlideShowContext.tsx
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

import React, { createContext, useContext, useMemo, useState, ReactNode, useCallback } from 'react';
import type { ResourceCard } from '@/app/Library/Definitions/Definitions';
import { useOrderedResources } from '@/app/studygraph/(studygraph)/components/hooks/useOrderedResources';
import SlideShowOverlay from '@/app/studygraph/(studygraph)/components/layout/CardDisplay/Cards/SlideShowOverlay';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';

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
}

const SlideShowContext = createContext<SlideShowContextValue | undefined>(undefined);

export const SlideShowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Default slides come from the current node selection via useOrderedResources()
  const defaultSlides = useOrderedResources();
  const {selectResources} = useResourceContext();

  // When overrideSlides is non-null, we use it; otherwise, fall back to defaultSlides
  const [overrideSlides, setOverrideSlides] = useState<ResourceCard[] | null>(null);
  let slides = overrideSlides !== null ? overrideSlides : defaultSlides;

  // Track whether the overlay is open and the current index into `slides`
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

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

  const openCustom = (slidesToShow: ResourceCard[]) => {
    // Replace the slides array with the caller's list, start at index 0, and open
    setOverrideSlides(slidesToShow);
    if (slidesToShow.length > 0) {
      setCurrentIndex(0);
      setIsOpen(true);
    }
  };

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
      openSelectedSlides
    }),
    [slides, isOpen, openSelectedSlides, currentIndex, currentSlide, open, close, gotoNext]
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
