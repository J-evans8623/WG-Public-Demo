/**
 * SlideShowOverlay.tsx - Enhanced Slideshow Component with Repositioned Layout (Legacy read only)
 * 
 * This component manages the complete slideshow experience with modal overlay functionality.
 * Key responsibilities include:
 * 
 * 1. Slide Display Management: Renders different slide types (note, cueCard, practiceSheet) in a modal dialog
 * 2. Navigation Controls: Provides previous/next navigation with keyboard shortcuts and jump-to-slide functionality
 * 3. Interactive Features: Supports AI assistance panel, discussion creation, bookmarking, and inline editing
 * 4. Layout Management: Implements repositioned header layout with concept map title at top and action buttons at bottom
 * 5. Accessibility: Full keyboard navigation support, proper ARIA labels, and screen reader compatibility
 * 6. State Management: Handles edit mode, AI loading states, discussion modals, and slide transitions
 * 7. Error Handling: Graceful handling of slide rendering errors and validation for jump navigation
 * 8. Responsive Design: Adaptive layout for mobile and desktop viewports with touch-friendly controls
 * 
 * The component integrates with multiple context providers for user data, comments, nodes, and slideshow state.
 * It supports full-screen editing mode for compatible slide types and provides seamless transitions between
 * view and edit states while preserving user position and context.
 */

import React, { useEffect, useState, useRef } from 'react';
import { X, ChevronsLeft, ChevronsRight, BookmarkIcon, MessageSquare, Brain } from 'lucide-react';
import { useSlideShow } from '@/app/Library/Context/ROSlideShowContext';
import NoteCard from './NoteCard';
import CueCard from './CueCard';
import QuizCard from '../../ReadOnly/CardDisplay/ROquizcard';
import AskAssistantPanel from './AskAssistantPanel';
import './SlideShowv2.css';

// —— NEW ——
import { useComments } from '@/app/Library/Context/forum/CommentContext';
import MentionBadge from '../../forum/MentionBadge';
import DiscussionFormInput from '../../forum/DiscussionFormInput';
import ReactDOM from 'react-dom';
import { useUserData } from '@/app/Library/Context/UserDataContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';

const SlideShowOverlay: React.FC = () => {
  // 1. Extract slideshow context and state management
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

  // 2. Initialize component state variables
  const [cueFlipped, setCueFlipped] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [askLoading, setAskLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const prevAskLoading = useRef(false);
  const [jumpTo, setJumpTo] = useState((currentIndex + 1).toString());
  const [isEditingSlideNumber, setIsEditingSlideNumber] = useState(false);
  const [tempSlideNumber, setTempSlideNumber] = useState('');
  const slideInputRef = useRef<HTMLInputElement>(null);
  const [isComposerOpen, setComposerOpen] = useState(false);

  // 3. Initialize additional context providers
  const { toggleBookmark, isBookmarked } = useUserData();
  const { getGlobalNode, getNodeTitle } = useNodesContext();
  const { getCommentCount, addPost } = useComments();

  /**
   * openInputModal - Opens the discussion composer modal
   * Responsible for initiating the discussion creation flow for the current slide
   */
  const openInputModal = () => {
    console.log('[SlideShowOverlay.tsx][2003] Opening discussion composer modal');
    setComposerOpen(true);
  }

  /**
   * closeInputModal - Closes the discussion composer modal
   * Responsible for dismissing the discussion creation interface and returning to slide view
   */
  const closeInputModal = () => {
    console.log('[SlideShowOverlay.tsx][2004] Closing discussion composer modal');
    setComposerOpen(false);
  }

  /**
   * canEditSlide - Determines slide editing capability
   * Validates whether the current slide type supports inline editing functionality
   * @param slideType The type of the current slide to check
   * @returns Boolean indicating if the slide supports editing
   */
  const canEditSlide = (slideType: string): boolean => {
    return ['note', 'cueCard', 'picture'].includes(slideType);
  };

  /**
   * handleEditStart - Initiates slide editing mode
   * Validates slide compatibility and transitions to full-screen edit interface
   * Preserves current slide context while switching to edit state
   */
  const handleEditStart = () => {
    if (!currentSlide || !canEditSlide(currentSlide.type)) {
      console.log('[SlideShowOverlay.tsx][5001] Edit not supported for slide type:', currentSlide?.type);
      return;
    }
    
    console.log('[SlideShowOverlay.tsx][5002] Starting edit mode for slide:', currentSlide.id);
    setIsEditing(true);
  };

  /**
   * handleEditSave - Processes successful edit completion
   * Handles the save operation completion and returns user to view mode
   * Maintains slide position and updates any cached slide data
   */
  const handleEditSave = () => {
    console.log('[SlideShowOverlay.tsx][5003] Edit save completed, returning to view mode');
    setIsEditing(false);
  };

  /**
   * handleEditCancel - Handles edit operation cancellation
   * Returns to view mode while discarding any unsaved changes
   * Preserves original slide state and user position
   */
  const handleEditCancel = () => {
    console.log('[SlideShowOverlay.tsx][5004] Edit cancelled, returning to view mode');
    setIsEditing(false);
  };

  // 4. Effect: Sync navigation state and reset panels on slide change
  useEffect(() => {
    console.log('[SlideShowOverlay.tsx][1001] Slide changed to index', currentIndex);
    setJumpTo((currentIndex + 1).toString());
    setAskOpen(false);
    setCueFlipped(false);
    setIsEditingSlideNumber(false);
    setIsEditing(false);
  }, [currentIndex]);

  // 5. Effect: Handle AI completion auto-advance
  useEffect(() => {
    if (prevAskLoading.current && !askLoading && !askOpen) {
      console.log('[SlideShowOverlay.tsx][1002] AI finished; advancing slide');
      gotoNext();
    }
    prevAskLoading.current = askLoading;
  }, [askLoading, askOpen, gotoNext]);

  // 6. Effect: Focus management for slide number editing
  useEffect(() => {
    if (isEditingSlideNumber && slideInputRef.current) {
      slideInputRef.current.focus();
      slideInputRef.current.select();
    }
  }, [isEditingSlideNumber]);

  // 7. Effect: Keyboard navigation and accessibility shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Block navigation during edit mode, slide number editing, or AI interaction
      if (askOpen || askLoading || isEditingSlideNumber || isEditing) return;

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
    isEditing,
    gotoNext,
    gotoPrev,
    close,
    currentIndex,
    currentSlide,
    cueFlipped,
  ]);

  // 8. Handle slide number click to start editing
  const handleSlideNumberClick = () => {
    if (askOpen || askLoading || isEditing) return;
    setTempSlideNumber((currentIndex + 1).toString());
    setIsEditingSlideNumber(true);
  };

  // 9. Handle slide number input changes
  const handleSlideNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) {
      setTempSlideNumber(value);
    }
  };

  // 10. Handle slide number input submission
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

  // 11. Handle slide number input key events
  const handleSlideNumberKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSlideNumberSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditingSlideNumber(false);
    }
  };

  // 12. Handle slide number input blur
  const handleSlideNumberBlur = () => {
    handleSlideNumberSubmit();
  };

  // 13. Early return if slideshow is not open
  if (!isOpen || !currentSlide) return null;

  // 14. Extract current slide and navigation data
  const nodetitle = getGlobalNode(currentSlide.mapId, currentSlide.nodeId)?.title;
  const secondaryTitle = currentSlide.title;

  const slideId = currentSlide.id;
  const bookmarked = isBookmarked(slideId);
  const prevTitle = slides[currentIndex - 1]?.title || 'Start of deck';
  const nextTitle = slides[currentIndex + 1]?.title || 'End of deck';

  /**
   * handleToggleBookmark - Manages bookmark state for current slide
   * Toggles bookmark status and updates user preferences with slide metadata
   */
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

  // 15. Handle comment modal rendering
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


  /**
   * renderSlide - Renders the appropriate slide component based on type
   * Handles different slide types with proper configuration and error handling
   * @returns JSX element for the current slide or null for unsupported types
   */
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
        return <QuizCard title={nodetitle!} content={quizData} parentQuizId={currentSlide.id} mapId={currentSlide.mapId}/>;
      }
      default:
        return null;
    }
  };

  // 17. Configure main click handler for cue card flipping
  const handleMainClick = currentSlide.type === 'cueCard' && !isEditing
    ? () => {
        console.log('[SlideShowOverlay.tsx][1008] Main click flip cue card');
        setCueFlipped(f => !f);
      }
    : undefined;

  // 18. Render main slideshow interface
  return (
    <>
      <div className="slideshow-backdrop" onClick={close} />

      <div className="slideshow-dialog" role="dialog" aria-modal="true">
        {/* Updated Header with Concept Map Title and Edit/Bookmark Actions */}
        <header className="slideshow-header">
          <div className="slideshow-header-left">
            <div className="slideshow-header-concept">
              <h1 className="slideshow-concept-name">{nodetitle}</h1>
              {secondaryTitle && (
    <span className="slideshow-concept-secondary">{secondaryTitle}</span>
  )}
            </div>
          </div>
          <div className="slideshow-header-actions">

            {/* Bookmark Button */}
            <button
              className="slideshow-bookmark-btn"
              title={bookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
              onClick={handleToggleBookmark}
            >
              <BookmarkIcon size={16} className={bookmarked ? 'bookmarked' : ''} />
            </button>
            
            {/* Close Button */}
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

        {/* Updated Footer with AI and Discussion Buttons Plus Navigation */}
        <div className="slideshow-footer">
          <div className="slideshow-footer-actions">
            
            {/* Discussion Button */}
            <button 
              className="slideshow-header-btn discussion-btn"
              onClick={openInputModal}
            >
              <MessageSquare size={14} />
              Discuss
            </button>
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