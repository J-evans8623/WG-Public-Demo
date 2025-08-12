/**
 * @file ForumModal.tsx
 * @description
 *   Discussion Forum modal container and host for both list and thread views. This file renders:
 *   (1) the modal shell and header; (2) filters/search (list view); (3) the scroll content region;
 *   and (4) a dedicated, absolutely positioned overlay layer that anchors two UI elements outside
 *   the scroll flow: the Back-to-Discussions bar at the top of the scroll area and the reply
 *   composer at the bottom. Anchoring these to the modal (not the scroller) prevents the classic
 *   “content peeking behind sticky UI” issue during scroll. A focused ResizeObserver measures the
 *   live heights of the header/top overlay/bottom overlay and writes CSS variables onto the modal
 *   (`--header-h`, `--threadbar-h`, `--composer-h`). The scroll region uses those variables to pad
 *   itself so content never sits underneath overlays (no hardcoded offsets). Purposeful logs with
 *   file + 4-digit codes mark: open/close, overlay metrics updates, and critical actions so you can
 *   trace the UI state. Colors/spacing remain tokenized; only small layout additions support this
 *   overlay strategy. No Canvas APIs are used, and the rest of the styling is preserved.
 *
 * Responsibilities:
 *   1) Render the modal shell, header, list or thread view, and a dedicated overlay layer.
 *   2) Expose a bottom overlay mount (<div id="forum-composer-overlay">) for the composer portal.
 *   3) Observe header/top/bottom overlay sizes and set CSS variables to drive scroll padding.
 *   4) Keep logging terse and high-signal for debugging major lifecycle/size transitions.
 *   5) Preserve existing brand tokens, spacing, and component styling wherever possible.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { formatDistanceToNow } from 'date-fns';
import { X, ArrowLeft } from 'lucide-react';
import { ForumList } from './comment/ForumPost';
import CommentInputModal from './CommentInputModal';
import ForumPostDetail from './ForumPostDetail';
import { useComments } from '@/app/Library/Context/CommentContext';
import './ForumModal.css';

interface ForumModalProps {
  initialSlideId?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

type FilterKey = 'all' | 'mine' | 'unanswered' | 'recent' | 'hot';

/**
 * @function useOverlayMetrics
 * @description
 *   Measure overlay heights and write CSS variables for safe scroll padding. This hook watches:
 *   (a) the modal header, (b) the top overlay (thread bar), and (c) the bottom overlay (composer
 *   mount). On every size change (or window resize), it sets `--header-h`, `--threadbar-h`, and
 *   `--composer-h` on the modal element, which the scroll container then uses to avoid placing
 *   content underneath overlays. Logs include previous/next values to verify correctness without
 *   spamming the console, and construction avoids optional-chaining with `new` for TS/ESLint.
 */
function useOverlayMetrics(params: {
  modalRef: React.RefObject<HTMLElement>;
  headerRef: React.RefObject<HTMLElement>;
  topRef: React.RefObject<HTMLElement>;
  bottomRef: React.RefObject<HTMLElement>;
}) {
  useEffect(() => {
    // 1) Resolve DOM nodes we need to measure; bail if core nodes are missing.
    const modalEl = params.modalRef.current;
    const headerEl = params.headerRef.current;
    if (!modalEl || !headerEl) return;

    // 2) Define a single write operation that reads and sets CSS variables.
    const writeVars = () => {
      // Step 2.1: Read current sizes.
      const headerH = headerEl.getBoundingClientRect().height || 0;
      const topH = params.topRef.current?.getBoundingClientRect().height || 0;
      const bottomH = params.bottomRef.current?.getBoundingClientRect().height || 0;

      // Step 2.2: Snapshot previous CSS variable values for debugging.
      const prev = {
        header: getComputedStyle(modalEl).getPropertyValue('--header-h').trim(),
        top: getComputedStyle(modalEl).getPropertyValue('--threadbar-h').trim(),
        bottom: getComputedStyle(modalEl).getPropertyValue('--composer-h').trim(),
      };

      // Step 2.3: Write new values in pixels (rounded to avoid sub-pixel drift).
      modalEl.style.setProperty('--header-h', `${Math.round(headerH)}px`);
      modalEl.style.setProperty('--threadbar-h', `${Math.round(topH)}px`);
      modalEl.style.setProperty('--composer-h', `${Math.round(bottomH)}px`);

      // Step 2.4: Purposeful debug log.
      console.log('ForumModal.tsx [FMOD3001] › overlay metrics updated', {
        prev,
        next: { headerH, topH, bottomH },
      });
    };

    // 3) Build a safe ResizeObserver ctor; avoid optional chaining on `new`.
    const ResizeObserverCtor: typeof ResizeObserver | undefined =
      typeof window !== 'undefined' ? (window as any).ResizeObserver : undefined;

    // 4) Attach observers to header/top/bottom; keep a local handle for cleanup.
    let ro: ResizeObserver | undefined;
    if (ResizeObserverCtor) {
      ro = new ResizeObserverCtor(() => writeVars());
      ro.observe(headerEl);
      if (params.topRef.current) ro.observe(params.topRef.current);
      if (params.bottomRef.current) ro.observe(params.bottomRef.current);
    } else {
      console.log('ForumModal.tsx [FMOD3002] › ResizeObserver unavailable, window resize fallback active');
    }

    // 5) Initial write + window resize fallback (for zoom/font-size changes).
    writeVars();
    const onResize = () => writeVars();
    window.addEventListener('resize', onResize);

    // 6) Cleanup observers and listeners.
    return () => {
      window.removeEventListener('resize', onResize);
      if (ro) {
        try { ro.disconnect(); } catch { /* no-op */ }
      }
    };
  }, [params.modalRef, params.headerRef, params.topRef, params.bottomRef]);
}

const ForumModal: React.FC<ForumModalProps> = ({
  initialSlideId = null,
  isOpen,
  onClose,
}) => {
  const commentsApi = useComments();
  const { posts, addPost, addComment } = commentsApi;
  const currentUserId = (commentsApi as any)?.currentUserId ?? null;

  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [isComposerVisible, setComposerVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');

  // ── Overlay refs (modal root, header, top overlay, bottom overlay) ─────────
  const modalRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const topOverlayRef = useRef<HTMLDivElement>(null);
  const bottomOverlayRef = useRef<HTMLDivElement>(null);

  // Observe overlay/header sizes and expose CSS variables for scroll padding.
  useOverlayMetrics({
    modalRef,
    headerRef,
    topRef: topOverlayRef,
    bottomRef: bottomOverlayRef,
  });

  // ── Lifecycle: open/close + Escape handling ─────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    console.log(
      `ForumModal.tsx [FMOD1001] › opened (${initialSlideId ? `slide ${initialSlideId}` : 'global'})`
    );
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        console.log('ForumModal.tsx [FMOD1002] › Escape pressed – closing');
        onClose();
      }
    };
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('keydown', onEsc);
      console.log('ForumModal.tsx [FMOD1003] › closed / unmounted');
    };
  }, [isOpen, initialSlideId, onClose]);

  // ── Data shaping for list view (unchanged visual language) ─────────────────
  const raw = useMemo(() => Array.from(posts.values()), [posts]);

  const forumData = useMemo(() => {
    const base = raw
      .filter(p => !initialSlideId || p.resourceId === initialSlideId)
      .map(p => ({
        id: p.id as string,
        title: (p.body as string) ?? '',
        author: (p.authorUID as string) ?? '',
        ts: (p.ts as number) ?? 0,
        timeAgo: formatDistanceToNow(new Date(p.ts), { addSuffix: true }),
        replyCount: Array.isArray(p.replies) ? p.replies.length : 0,
        tags: [
          { id: p.lessonTitleId, label: p.lessonTitle, type: 'primary' as const },
          { id: p.subtopicTitle, label: p.subtopicTitle, type: 'secondary' as const },
        ],
      }));

    let filtered = base;
    switch (activeFilter) {
      case 'mine': filtered = currentUserId ? base.filter(b => b.author === currentUserId) : base; break;
      case 'unanswered': filtered = base.filter(b => b.replyCount === 0); break;
      case 'recent': filtered = [...base].sort((a, b) => b.ts - a.ts); break;
      case 'hot': filtered = [...base].sort((a, b) => b.replyCount - a.replyCount); break;
      case 'all':
      default: break;
    }

    const q = query.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(b =>
        [b.title, b.author, ...b.tags.map(t => t.label || '')]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    return filtered;
  }, [raw, activeFilter, query, currentUserId, initialSlideId]);

  if (!isOpen) return null;

  // ── List view actions (unchanged) ──────────────────────────────────────────
  const handleNewPost = () => {
    console.log('ForumModal.tsx [FMOD1011] › show composer');
    setComposerVisible(true);
  };

  const handleCreatePost = (_slideId: string, body: string) => {
    console.log('ForumModal.tsx [FMOD1012] › creating post', { initialSlideId, body });
    addPost({
      lessonTitle: '',
      lessonTitleId: '',
      subtopicTitle: '',
      resourceId: initialSlideId ?? '',
      body,
    });
    setComposerVisible(false);
  };

  const handlePostClick = (id: string) => {
    console.log('ForumModal.tsx [FMOD1013] › open thread', id);
    setDetailPostId(id);
  };
  const handleBackToList = () => {
    console.log('ForumModal.tsx [FMOD1014] › back to list');
    setDetailPostId(null);
  };

  // ── Portal into the app root ───────────────────────────────────────────────
  return ReactDOM.createPortal(
    <div className="forum-backdrop" onClick={onClose}>
      <section
        ref={modalRef}
        className="forum-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Discussion forum"
        onClick={e => e.stopPropagation()}
      >
        {/* Header (measured for --header-h) */}
<header ref={headerRef} className="forum-header fm-header">
  <div className="forum-header__left fm-header-top">
    <h2 className="forum-title fm-title">
      Discussion Forum
    </h2>
  </div>

  <div className="forum-header__right fm-header-actions">
    {!detailPostId && (
      <button
        className="fm-btn fm-btn-primary"
        onClick={handleNewPost}
      >
        + Start Discussion
      </button>
    )}
    <button
      className="btn btn--icon btn--border fm-close-btn"
      onClick={onClose}
      title="Close forum"
      aria-label="Close forum"
    >
      <X size={18} />
    </button>
  </div>
</header>

        {/* Overlay layer: top threadbar + bottom composer mount (true overlays) */}
        <div className="forum-overlay-layer" aria-hidden={false}>
          {detailPostId && (
            <div ref={topOverlayRef} className="forum-overlay forum-overlay--top">
              <button
                className="btn btn--border"
                onClick={handleBackToList}
                title="Back to Discussions"
              >
                <ArrowLeft size={16} aria-hidden />
                Back to Discussions
              </button>
            </div>
          )}
          <div
            ref={bottomOverlayRef}
            id="forum-composer-overlay"
            className="forum-overlay forum-overlay--bottom"
          />
        </div>

        {/* Scroll content — vertical padding is driven by overlay CSS variables */}
        <div className="forum-content scrollbar--thin">
          {detailPostId ? (
            <div className="forum-threadwrap">
              <ForumPostDetail
                postId={detailPostId}
                onClose={onClose}
                onReply={(parentId, body) => addComment(parentId, body)}
                hideClose
                composerPortalId="forum-composer-overlay"
              />
            </div>
          ) : (
            <>
              <div className="forum-filterbar" role="toolbar" aria-label="Forum filters">
                <button
                  className={`chip ${activeFilter === 'all' ? 'chip--active' : ''}`}
                  onClick={() => setActiveFilter('all')}
                >All Topics</button>
                <button
                  className={`chip ${activeFilter === 'mine' ? 'chip--active' : ''}`}
                  onClick={() => setActiveFilter('mine')}
                >My Posts</button>
                <button
                  className={`chip ${activeFilter === 'unanswered' ? 'chip--active' : ''}`}
                  onClick={() => setActiveFilter('unanswered')}
                >Unanswered</button>
                <button
                  className={`chip ${activeFilter === 'recent' ? 'chip--active' : ''}`}
                  onClick={() => setActiveFilter('recent')}
                >Recent</button>
                <button
                  className={`chip ${activeFilter === 'hot' ? 'chip--active' : ''}`}
                  onClick={() => setActiveFilter('hot')}
                >Most Discussed</button>
              </div>

              <div className="forum-search">
                <input
                  className="field"
                  type="text"
                  placeholder="Search discussions by topic, lesson, or keyword…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </div>

              <div className="divider" />

              <ForumList
                posts={forumData}
                onPostClick={handlePostClick}
                onNewPost={handleNewPost}
              />
              {isComposerVisible && (
                <CommentInputModal
                  slideId={initialSlideId ?? ''}
                  onPost={handleCreatePost}
                  onClose={() => setComposerVisible(false)}
                />
              )}
            </>
          )}
        </div>
      </section>
    </div>,
    document.getElementById('modal-root')!
  );
};

export default ForumModal;
