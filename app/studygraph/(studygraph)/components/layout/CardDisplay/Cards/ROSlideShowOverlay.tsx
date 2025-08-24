// SlideShowOverlay.tsx - Enhanced with Jump to Slide Feature

import React, { useEffect, useState, useRef } from 'react';
import { X, ChevronsLeft, ChevronsRight, BookmarkIcon, MessageSquare, Brain } from 'lucide-react';
import { useSlideShow } from '@/app/Library/Context/ROSlideShowContext';
import NoteCard from './NoteCard';
import CueCard from './CueCard';
import QuizCard from './QuizCard';
import AskAssistantPanel from './AskAssistantPanel';
import './SlideShowv2.css';

// —— NEW ——
import { useComments } from '@/app/Library/Context/CommentContext';
import MentionBadge from '../../forum/MentionBadge';
import DiscussionFormInput from '../../forum/DiscussionFormInput';
import ReactDOM from 'react-dom';
import { useUserData } from '@/app/Library/Context/UserDataContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';

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

  const [cueFlipped, setCueFlipped] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [askLoading, setAskLoading] = useState(false);
  const prevAskLoading = useRef(false);
  const [jumpTo, setJumpTo] = useState((currentIndex + 1).toString());
  const [isEditingSlideNumber, setIsEditingSlideNumber] = useState(false);
  const [tempSlideNumber, setTempSlideNumber] = useState('');
  const slideInputRef = useRef<HTMLInputElement>(null);
  const [isComposerOpen, setComposerOpen] = useState(false);
  const { toggleBookmark, isBookmarked } = useUserData();
  const { getGlobalNode, getNodeTitle } = useNodesContext();

  const { getCommentCount, addPost } = useComments();

  const openInputModal = () => {
    setComposerOpen(true);
  }

  const closeInputModal = () => {
    setComposerOpen(false);
  }

  // Sync jumpTo, reset panels, and reset flip on slide change
  useEffect(() => {
    console.log('[SlideShowOverlay.tsx][1001] Slide changed to index', currentIndex);
    setJumpTo((currentIndex + 1).toString());
    setAskOpen(false);
    setCueFlipped(false);
    setIsEditingSlideNumber(false); // Reset editing state when slide changes
  }, [currentIndex]);

  // Auto-advance when AI finishes
  useEffect(() => {
    if (prevAskLoading.current && !askLoading && !askOpen) {
      console.log('[SlideShowOverlay.tsx][1002] AI finished; advancing slide');
      gotoNext();
    }
    prevAskLoading.current = askLoading;
  }, [askLoading, askOpen, gotoNext]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingSlideNumber && slideInputRef.current) {
      slideInputRef.current.focus();
      slideInputRef.current.select();
    }
  }, [isEditingSlideNumber]);

  // Keyboard navigation & accessibility shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (askOpen || askLoading || isEditingSlideNumber) return;

      console.log('[SlideShowOverlay.tsx][1003] Key pressed:', e.key);

      // Navigate slides
      if (e.key === 'ArrowRight') {
        console.log('[SlideShowOverlay.tsx][1004] Navigating next from index', currentIndex);
        gotoNext();
      } else if (e.key === 'ArrowLeft') {
        console.log('[SlideShowOverlay.tsx][1005] Navigating prev from index', currentIndex);
        gotoPrev();
      }
      // Flip cue card
      else if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
        if (currentSlide && currentSlide.type === 'cueCard') {
          console.log(
            '[SlideShowOverlay.tsx][1006] Flipping cue card from',
            cueFlipped,
            'to',
            !cueFlipped
          );
          setCueFlipped(f => !f);
          e.preventDefault();
        }
      }
      // Close overlay
      else if (e.key === 'Escape') {
        console.log('[SlideShowOverlay.tsx][1007] Closing slideshow via Escape');
        close();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [
    askOpen,
    askLoading,
    isEditingSlideNumber,
    gotoNext,
    gotoPrev,
    close,
    currentIndex,
    currentSlide,
    cueFlipped,
  ]);

  // Handle slide number click to start editing
  const handleSlideNumberClick = () => {
    if (askOpen || askLoading) return;
    setTempSlideNumber((currentIndex + 1).toString());
    setIsEditingSlideNumber(true);
  };

  // Handle slide number input changes
  const handleSlideNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numeric input
    if (/^\d*$/.test(value)) {
      setTempSlideNumber(value);
    }
  };

  // Handle slide number input submission
  const handleSlideNumberSubmit = () => {
    const slideNumber = parseInt(tempSlideNumber, 10);
    if (!isNaN(slideNumber) && slideNumber >= 1 && slideNumber <= slides.length) {
      const targetIndex = slideNumber - 1;
      console.log('[SlideShowOverlay.tsx][1009] Jumping to slide number', slideNumber);
      const target = slides[targetIndex];
      open(target.id, false);
    }
    setIsEditingSlideNumber(false);
  };

  // Handle slide number input key events
  const handleSlideNumberKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSlideNumberSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditingSlideNumber(false);
    }
  };

  // Handle slide number input blur
  const handleSlideNumberBlur = () => {
    handleSlideNumberSubmit();
  };

  if (!isOpen || !currentSlide) return null;

  const nodetitle = getGlobalNode(currentSlide.mapId, currentSlide.nodeId)?.title;
  const slideId = currentSlide.id;
  const bookmarked = isBookmarked(slideId);
  const prevTitle = slides[currentIndex - 1]?.title || 'Start of deck';
  const nextTitle = slides[currentIndex + 1]?.title || 'End of deck';

  function handleToggleBookmark() {
    console.log('[SlideShowOverlay.tsx][3004] › Toggling bookmark for', slideId);
    toggleBookmark({
      resourceId: slideId,
      mapId: currentSlide!.mapId!,
      nodeId: currentSlide!.nodeId!,
      type: currentSlide!.type,
      timestamp: Date.now(),
    });
  }

if (isComposerOpen) {
  console.log('[SlideShowOverlay.tsx][2001] › displaying DiscussionFormInput for slide', currentSlide.id);
  return ReactDOM.createPortal(
    <>
      <div className="slideshow-backdrop" onClick={closeInputModal} />
      <div className="slideshow-dialog slideshow-discussion-form" role="dialog" aria-modal="true">
        <DiscussionFormInput
          onSubmit={(title: string, content: string) => {
            console.log('[SlideShowOverlay.tsx][2002] › creating new post with title:', title, 'content:', content);
            addPost({
              lessonTitle: nodetitle || 'Current Lesson',
              lessonTitleId: currentSlide.nodeId || 'node',
              subtopicTitle: currentSlide.title || 'Current Slide',
              resourceId: currentSlide.id,
              body: `${title}\n\n${content}`, // Combine title and content for body
            });
            closeInputModal();
          }}
          onCancel={closeInputModal}
          contextInfo={{
            lessonTitle: nodetitle || 'Current Lesson',
            slideTitle: currentSlide.title || 'Current Slide'
          }}
        />
      </div>
    </>,
    document.getElementById('modal-root')!
  );
}
  const renderSlide = () => {
    switch (currentSlide.type) {
      case 'note':
        return <NoteCard title={currentSlide.title} content={String(currentSlide.content)} />;
      case 'cueCard':
        return (
          <div className="cuecard-container">
            <CueCard
              title={currentSlide.title}
              content={String(currentSlide.content)}
              flipped={cueFlipped}
            />
          </div>
        );
      case 'practiceSheet': {
        let quizData: any = currentSlide.content;
        if (typeof quizData === 'string') {
          try {
            quizData = JSON.parse(quizData);
          } catch {
            /* ignore JSON errors */
          }
        }
        return <QuizCard title={currentSlide.title} content={quizData} parentQuizId={currentSlide.id} mapId={currentSlide.mapId}/>;
      }
      default:
        return null;
    }
  };

  const handleMainClick = currentSlide.type === 'cueCard'
    ? () => {
        console.log('[SlideShowOverlay.tsx][1008] Main click flip cue card');
        setCueFlipped(f => !f);
      }
    : undefined;

  return (
    <>
      <div className="slideshow-backdrop" onClick={close} />

      <div className="slideshow-dialog" role="dialog" aria-modal="true">
        <header className="slideshow-header">
          <div className="slideshow-header-left">
            <h2 className="slideshow-title" title={currentSlide.title}>
              {currentSlide.title}
            </h2>
          </div>
          <div className="slideshow-header-actions">
            <button 
              className="slideshow-header-btn ai-btn"
              onClick={() => { 
                console.log('[SlideShowOverlay.tsx][1013] Ask Assistant opened'); 
                setAskOpen(true); 
              }}
              disabled={askLoading}
            >
              <Brain size={14} />
              Ask AI
            </button>
            <button 
              className="slideshow-header-btn discussion-btn"
              onClick={openInputModal}
            >
              <MessageSquare size={14} />
              Discuss
            </button>
            <button
              className="slideshow-bookmark-btn"
              title={bookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
              onClick={handleToggleBookmark}
            >
              <BookmarkIcon size={16} className={bookmarked ? 'bookmarked' : ''} />
            </button>
            <button className="slideshow-close" onClick={close} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </header>

        <main
          className="slideshow-body"
          onClick={handleMainClick}
          title={currentSlide.type === 'cueCard' ? 'Click to flip card' : undefined}
        >
          {askLoading ? (
            <div className="slideshow-loading-container">
              <div className="slideshow-spinner" />
            </div>
          ) : (
            renderSlide()
          )}
        </main>

        {/* Slide Footer */}
        <div className="slideshow-footer">
          <div className="slideshow-concept-info">
            <span className="slideshow-concept-name">{nodetitle}</span>
          </div>
          <div className="slideshow-slide-nav">
            <button 
              className="slideshow-nav-btn" 
              disabled={currentIndex === 0}
              onClick={() => { console.log('[SlideShowOverlay.tsx][1011] Prev button clicked'); gotoPrev(); }}
            >
              Previous
            </button>
            
            {/* Enhanced slide counter with jump functionality */}
            <div className="slideshow-counter-container">
              {isEditingSlideNumber ? (
                <div className="slideshow-counter-input-container">
                  <input
  ref={slideInputRef}
  type="text"
  inputMode="numeric"
  pattern="\d*"
  value={tempSlideNumber}
  onChange={handleSlideNumberChange}
  onKeyDown={handleSlideNumberKeyDown}
  onBlur={handleSlideNumberBlur}
  className="slideshow-counter-input"
  size={String(slides.length).length}
  maxLength={String(slides.length).length}
  aria-label="Jump to slide"
/>
<span className="slideshow-counter-separator"> of </span>
<span className="slideshow-counter-total">{slides.length}</span>

                </div>
              ) : (
                <button
                  className="slideshow-counter-clickable"
                  onClick={handleSlideNumberClick}
                  title="Click to jump to a specific slide"
                  disabled={askOpen || askLoading}
                >
                  <span className="slideshow-counter-current">{currentIndex + 1}</span>
                  <span className="slideshow-counter-separator"> of </span>
                  <span className="slideshow-counter-total">{slides.length}</span>
                </button>
              )}
            </div>
            
            <button 
              className="slideshow-nav-btn slideshow-nav-btn-next"
              disabled={currentIndex >= slides.length - 1}
              onClick={() => { console.log('[SlideShowOverlay.tsx][1012] Next button clicked'); gotoNext(); }}
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {askOpen && (
        <AskAssistantPanel
          onClose={() => { console.log('[SlideShowOverlay.tsx][1014] Ask Assistant closed'); setAskOpen(false); }}
          onLoading={setAskLoading}
        />
      )}
    </>
  );
};

export default SlideShowOverlay;