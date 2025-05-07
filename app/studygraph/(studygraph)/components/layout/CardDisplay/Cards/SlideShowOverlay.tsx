// File: app/studygraph/(studygraph)/components/layout/CardDisplay/Cards/SlideShowOverlay.tsx

import React, { useEffect, useState, useRef } from 'react';
import { X, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';
import NoteCard from './NoteCard';
import ImageCard from './ImageCard';
import CueCard from './CueCard';
import QuizCard from './QuizCard';
import AskAssistantPanel from './AskAssistantPanel';
import './slideshow.css';

/**
 * SlideShowOverlay
 * - Dims the rest of the app with a backdrop
 * - Renders a fixed-size slide dialog
 * - Floats Prev/Next arrows entirely outside the card, with tooltips
 * - Provides an "Ask Assistant" capsule button at bottom-right
 * - Displays a spinner overlay when awaiting AI
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
  } = useSlideShow();

  const [cueFlipped, setCueFlipped] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [askLoading, setAskLoading] = useState(false);
  const prevAskLoading = useRef(false);

  // Reset state on slide change
  useEffect(() => {
    setCueFlipped(false);
    setAskOpen(false);
  }, [currentIndex]);

  // After AI response, advance to the new slide
  useEffect(() => {
    if (prevAskLoading.current && !askLoading && !askOpen) {
      gotoNext();
    }
    prevAskLoading.current = askLoading;
  }, [askLoading, askOpen, gotoNext]);

  // Keyboard navigation (disabled while assistant open/spinning)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (askOpen || askLoading) return;
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'ArrowRight') gotoNext();
      else if (isMod && e.key === 'ArrowLeft') gotoPrev();
      else if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [askOpen, askLoading, gotoNext, gotoPrev, close]);

  if (!isOpen || !currentSlide) return null;

  // Titles for tooltips
  const prevTitle = slides[currentIndex - 1]?.title || 'Start of deck';
  const nextTitle = slides[currentIndex + 1]?.title || 'End of deck';

  // Main slide renderer
  const renderSlide = () => {
    switch (currentSlide.type) {
      case 'note':
        return <NoteCard title={currentSlide.title} content={String(currentSlide.content)} />;
      case 'picture':
        return (
          <ImageCard
            title={currentSlide.title}
            content={String((currentSlide as any).description)}
            imageUrl={(currentSlide as any).imageUrl || ''}
            interactive
          />
        );
      case 'cueCard':
        return (
          <CueCard
            title={currentSlide.title}
            content={String(currentSlide.content)}
            flipped={cueFlipped}
          />
        );
      case 'practiceSheet': {
        let quizData: any = currentSlide.content;
        if (typeof quizData === 'string') {
          try { quizData = JSON.parse(quizData); } catch {}
        }
        return <QuizCard title={currentSlide.title} content={quizData} />;
      }
      default:
        return null;
    }
  };

  // Clicking the body flips a cue card
  const handleMainClick = currentSlide.type === 'cueCard'
    ? () => setCueFlipped(f => !f)
    : undefined;

  return (
    <>
      {/* Full-screen dimmed backdrop */}
      <div className="slideshow-backdrop" onClick={close} />

      {/* Centered slide dialog */}
      <div className="slideshow-dialog" role="dialog" aria-modal="true">
        <header className="slideshow-header">
          <span className="slideshow-badge">
            {{
              note: 'Note Card',
              picture: 'Image Card',
              cueCard: 'Cue Card',
              practiceSheet: 'Quiz',
            }[currentSlide.type]}
          </span>
          <h2 className="slideshow-title">
            {(currentSlide as any).conceptNodeTitle || currentSlide.title}
          </h2>
          <button
            className="slideshow-close"
            onClick={close}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </header>

        <main
          className="slideshow-body"
          onClick={handleMainClick}
          title={currentSlide.type === 'cueCard' ? 'Click to flip card' : undefined}
        >
          {askLoading
            ? <div className="slideshow-loading-container"><div className="slideshow-spinner" /></div>
            : renderSlide()
          }
        </main>

        {/* Floating Prev arrow (outside width) */}
        {!askLoading && !askOpen && currentIndex > 0 && (
          <button
            className="slideshow-nav-arrow prev"
            onClick={gotoPrev}
            title={`Previous: ${prevTitle}`}
          >
            <ChevronsLeft size={32} />
          </button>
        )}
        {/* Floating Next arrow */}
        {!askLoading && !askOpen && currentIndex < slides.length - 1 && (
          <button
            className="slideshow-nav-arrow next"
            onClick={gotoNext}
            title={`Next: ${nextTitle}`}
          >
            <ChevronsRight size={32} />
          </button>
        )}

        {/* Ask-Assistant capsule button */}
        <button
          className="slideshow-ask-capsule"
          onClick={() => setAskOpen(true)}
          disabled={askLoading}
        >
          Ask Assistant
        </button>
      </div>

      {/* Slide-in “Ask Assistant” panel */}
      {askOpen && (
        <AskAssistantPanel
          onClose={() => setAskOpen(false)}
          onLoading={setAskLoading}
        />
      )}
    </>
  );
};

export default SlideShowOverlay;
