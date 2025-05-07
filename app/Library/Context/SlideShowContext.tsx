import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import type { ResourceCard } from '@/app/Library/Definitions/Definitions';
import { useOrderedResources } from '@/app/studygraph/(studygraph)/components/hooks/useOrderedResources';
import SlideShowOverlay from '@/app/studygraph/(studygraph)/components/layout/CardDisplay/Cards/SlideShowOverlay';

interface SlideShowContextValue {
  slides: ResourceCard[];
  isOpen: boolean;
  currentIndex: number;
  currentSlide: ResourceCard | null;
  open: (resourceId: string) => void;
  close: () => void;
  gotoNext: () => void;
  gotoPrev: () => void;
}

const SlideShowContext = createContext<SlideShowContextValue | undefined>(undefined);

export const SlideShowProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const slides = useOrderedResources();
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const open = (resourceId: string) => {
    const idx = slides.findIndex(r => r.id === resourceId);
    if (idx >= 0) {
      setCurrentIndex(idx);
      setIsOpen(true);
    }
  };

  const close = () => setIsOpen(false);
  const gotoNext = () => setCurrentIndex(i => Math.min(i + 1, slides.length - 1));
  const gotoPrev = () => setCurrentIndex(i => Math.max(i - 1, 0));

  const currentSlide = useMemo(() => slides[currentIndex] || null, [slides, currentIndex]);

  const value = useMemo(
    () => ({ slides, isOpen, currentIndex, currentSlide, open, close, gotoNext, gotoPrev }),
    [slides, isOpen, currentIndex, currentSlide]
  );

  return (
    <SlideShowContext.Provider value={value}>
      {children}
      {/* Mount the overlay once per provider */}
      <SlideShowOverlay />
    </SlideShowContext.Provider>
  );
};

export function useSlideShow(): SlideShowContextValue {
  const ctx = useContext(SlideShowContext);
  if (!ctx) throw new Error('useSlideShow must be used within a SlideShowProvider');
  return ctx;
}
