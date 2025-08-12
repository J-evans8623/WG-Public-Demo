// File: app/studygraph/(studygraph)/components/layout/CardDisplay/Cards/SlideShowOverlay.tsx

/**
 * SlideShowOverlay
 * Responsibilities:
 * - Dim the rest of the app with a full-screen backdrop
 * - Render a centered slide dialog with header, body, and controls
 * - Support Prev/Next navigation via buttons and left/right arrow keys
 * - Allow flipping of cue cards via spacebar
 * - Provide Ask Assistant panel toggle and spinner overlay
 * - Expose slide count with editable input for direct jumps
 * - Log critical user interactions and state changes for debugging
 */

import React, { useEffect, useState, useRef } from 'react';
import { X, ChevronsLeft, ChevronsRight, BookmarkIcon } from 'lucide-react';
import { useSlideShow } from '@/app/Library/Context/SlideShowContext';
import NoteCard from './NoteCard';
import ImageCard from './ImageCard';
import CueCard from './CueCard';
import QuizCard from './QuizCard';
import AskAssistantPanel from './AskAssistantPanel';
import './slideshow.css';

// —— NEW ——
import { useComments } from '@/app/Library/Context/CommentContext';
import MentionBadge from '../../forum/MentionBadge';
import DiscussButton from '../../forum/DiscussButton';
import CommentInputModal from '../../forum/CommentInputModal';
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
  const [isComposerOpen, setComposerOpen] = useState(false);
  const { toggleBookmark, isBookmarked } = useUserData();
  const { getGlobalNode } = useNodesContext();

  

  

  const { getCommentCount,
    openForum,
    addPost,
   } = useComments();

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
  }, [currentIndex]);

  // Auto-advance when AI finishes
  useEffect(() => {
    if (prevAskLoading.current && !askLoading && !askOpen) {
      console.log('[SlideShowOverlay.tsx][1002] AI finished; advancing slide');
      gotoNext();
    }
    prevAskLoading.current = askLoading;
  }, [askLoading, askOpen, gotoNext]);

  // Keyboard navigation & accessibility shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (askOpen || askLoading) return;

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
    gotoNext,
    gotoPrev,
    close,
    currentIndex,
    currentSlide,
    cueFlipped,
  ]);


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
  console.log('[SlideShowOverlay.tsx][2001] › displaying CommentInputModal for slide', currentSlide.id);
  return ReactDOM.createPortal(
    <>
      <div className="slideshow-backdrop" onClick={closeInputModal} />
      <div className="slideshow-dialog" role="dialog" aria-modal="true">
        <CommentInputModal
          slideId={currentSlide.id}
          onPost={(_slideId, heading ,body) => {
            console.log('[SlideShowOverlay.tsx][2002] › creating new post:', body);
            // Always create a new top‐level post when invoked from the slide
            addPost({
              lessonTitle: 'test',        // TODO: inject real slide metadata
              lessonTitleId: 'test',
              subtopicTitle: 'test',
              resourceId: currentSlide.id,
              body,
            });
            closeInputModal();
          }}
          onClose={closeInputModal}
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

  const maybeJump = () => {
    const num = parseInt(jumpTo.trim(), 10);
    if (!isNaN(num) && num >= 1 && num <= slides.length) {
      console.log('[SlideShowOverlay.tsx][1009] Jumping to slide number', num);
      const target = slides[num - 1];
      open(target.id, false);
    } else {
      console.log('[SlideShowOverlay.tsx][1010] Invalid jump input, reverting to', currentIndex + 1);
      setJumpTo((currentIndex + 1).toString());
    }
  };

  return (
    <>
      <div className="slideshow-backdrop" onClick={close} />

      <div className="slideshow-dialog" role="dialog" aria-modal="true">
        <header className="slideshow-header">
          <h2 className="slideshow-title">
            {nodetitle || currentSlide.title}
          </h2>
          <button className="slideshow-close" onClick={close} aria-label="Close">
            <X size={20} />
          </button>
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

        {/* Bookmark Button (NEW) */}
        <button
          title={bookmarked ? 'Remove Bookmark' : 'Add Bookmark'}
          onClick={handleToggleBookmark}
          className="absolute top-4 right-12 p-1"
        >
          <BookmarkIcon size={24} className={bookmarked ? 'text-yellow-500' : 'text-gray-400'} />
        </button>

        {!askLoading && !askOpen && currentIndex > 0 && (
          <button
            className="slideshow-nav-arrow prev"
            onClick={() => { console.log('[SlideShowOverlay.tsx][1011] Prev button clicked'); gotoPrev(); }}
            title={`Previous: ${prevTitle}`}
          >
            <ChevronsLeft size={32} />
          </button>
        )}
        {!askLoading && !askOpen && currentIndex < slides.length - 1 && (
          <button
            className="slideshow-nav-arrow next"
            onClick={() => { console.log('[SlideShowOverlay.tsx][1012] Next button clicked'); gotoNext(); }}
            title={`Next: ${nextTitle}`}
          >
            <ChevronsRight size={32} />
          </button>
        )}

        <button
          className="slideshow-ask-capsule"
          onClick={() => { console.log('[SlideShowOverlay.tsx][1013] Ask Assistant opened'); setAskOpen(true); }}
          disabled={askLoading}
        >
          Ask Assistant
        </button>

        <div className="slideshow-counter">
          <input
            className="slideshow-counter-input"
            type="text"
            value={jumpTo}
            onChange={e => setJumpTo(e.target.value)}
            onBlur={maybeJump}
            onKeyDown={e => {
              if (e.key === 'Enter') maybeJump();
            }}
          />
          <span>of {slides.length}</span>
        </div>
            {/* ── Discussion entry controls ── */}
        <div
          style={{
            position: 'absolute',
            bottom: '1rem',
            left: '1rem',
            display: 'flex',
            gap: '0.5rem',
            zIndex: 10,
          }}
        >
          <MentionBadge
            count={getCommentCount(slideId)}
            onClick={() => openForum()}
          />
          <DiscussButton
            slideId={slideId}
            onOpen={(id) => {
              console.log('SlideShowOverlay.tsx [SSOV1012] › Discuss clicked', id);
              openInputModal();
            }}
          />
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