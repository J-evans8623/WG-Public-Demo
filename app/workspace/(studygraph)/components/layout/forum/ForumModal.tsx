/**
 * ForumModal.tsx (branded shell + pinned guidance)
 * - Uses the shared modal shell from modalStyles.css
 * - Now styled with branded-forum.css for clean divider aesthetic
 * - Larger width, single scroll owner
 * - Branded header actions and tabs
 * - Adds a synthetic pinned guidance post that's always visible in the list
 *   (does not change CommentContext data)
 */

import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { formatDistanceToNow } from 'date-fns';
import { X } from 'lucide-react';
import { useComments } from '@/app/Library/Context/forum/CommentContext';
import ForumPost from './comment/ForumPost';
import DiscussionThread from './DiscussionThread';
import DiscussionFormInput from './DiscussionFormInput';

import '@/app/workspace/(studygraph)/components/modals/modalStyles.css';
import './branded-forum.css';

interface ForumModalProps {
  initialSlideId?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

type FilterKey = 'all' | 'mine' | 'unanswered' | 'recent' | 'hot';

const PINNED_ID = 'system_welcome';

const ForumModal: React.FC<ForumModalProps> = ({
  initialSlideId = null,
  isOpen,
  onClose,
}) => {
  const commentsApi = useComments();
  const { posts, addPost, getUnseenCount } = commentsApi;
  const currentUserId = (commentsApi as any)?.currentUserId ?? null;

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // --- filter existing posts (unchanged logic) ---
  const filteredPosts = useMemo(() => {
    const postArray = Array.from(posts.values());

    const contextFiltered = initialSlideId
      ? postArray.filter((p) => p.resourceId === initialSlideId)
      : postArray;

    let filtered = contextFiltered;
    switch (activeFilter) {
      case 'mine':
        filtered = currentUserId
          ? contextFiltered.filter((p) => p.authorUID === currentUserId)
          : contextFiltered;
        break;
      case 'unanswered':
        filtered = contextFiltered.filter((p) => p.replies.length === 0);
        break;
      case 'recent':
        filtered = [...contextFiltered].sort((a, b) => b.ts - a.ts);
        break;
      case 'hot':
        filtered = [...contextFiltered].sort(
          (a, b) => b.replies.length - a.replies.length
        );
        break;
      case 'all':
      default:
        break;
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (p) =>
          p.body.toLowerCase().includes(q) ||
          p.authorUID.toLowerCase().includes(q) ||
          p.lessonTitle.toLowerCase().includes(q) ||
          p.subtopicTitle.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [posts, activeFilter, searchQuery, currentUserId, initialSlideId]);

  // --- create a synthetic pinned post for display only ---
  const pinnedPost = useMemo(() => {
    const ts = 0; // oldest to keep it stable against "Recent"
    return {
      id: PINNED_ID,
      lessonTitle: 'Discussion Forum',
      lessonTitleId: 'forum',
      subtopicTitle: 'Getting Started',
      postTitle: 'Stay connected with your peers',
      body:
        'Use the discussion forum to stay in contact with anyone who has access to this notebook. Invite other collaborators to start having discussions.',
      authorUID: 'System',
      resourceId: initialSlideId || 'general',
      ts,
      replies: [] as any[],
    };
  }, [initialSlideId]);

  // --- decide what the list should render ---
  const displayPosts = useMemo(() => {
    // We always show the pinned guidance at the top of the list view.
    // It's not part of CommentContext and won't affect unseen/hot counts.
    const list = [pinnedPost, ...filteredPosts];
    return list;
  }, [filteredPosts, pinnedPost]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isFormOpen) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, isFormOpen, onClose]);

  const handleStartDiscussion = () => setFormOpen(true);

  const handlePostCreated = (title: string, content: string) => {
    addPost({
      lessonTitle: 'Discussion Forum',
      lessonTitleId: 'forum',
      subtopicTitle: 'General',
      body: content,
      postTitle: title,
      resourceId: initialSlideId || 'general',
    });
    setFormOpen(false);
  };

  const handlePostClick = (postId: string) => setSelectedPostId(postId);
  const handleBackToList = () => setSelectedPostId(null);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div
        className="modal-container forum-shell"
        onClick={(e) => e.stopPropagation()}
        aria-labelledby="forum-title"
      >
        {/* Header */}
        <div className="forum-header">
          <h2 id="forum-title" className="forum-title">
            Discussion Forum
          </h2>
          <div className="forum-actions">
            {!selectedPostId && !isFormOpen && (
              <button className="btn btn-primary" onClick={handleStartDiscussion}>
                + New
              </button>
            )}
            <button className="icon-btn" aria-label="Close forum" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body (single scroll owner) */}
        <div className="forum-body">
          {/* List / Compose / Thread */}
          {isFormOpen ? (
            <DiscussionFormInput
              onSubmit={handlePostCreated}
              onCancel={() => setFormOpen(false)}
              contextInfo={
                initialSlideId
                  ? { lessonTitle: 'Current Lesson', slideTitle: 'Current Slide' }
                  : undefined
              }
            />
          ) : selectedPostId ? (
            <DiscussionThread postId={selectedPostId} onBack={handleBackToList} />
          ) : (
            <>
              {/* Tabs + Search sticky sub-header */}
              <div className="forum-sticky-subheader">
                <div className="forum-tabs" role="tablist" aria-label="Filters">
                  {([
                    { key: 'all' as const, label: 'All Topics' },
                    { key: 'mine' as const, label: 'My Posts' },
                    { key: 'unanswered' as const, label: 'Unanswered' },
                    { key: 'recent' as const, label: 'Recent' },
                    { key: 'hot' as const, label: 'Most Discussed' },
                  ]).map(({ key, label }) => (
                    <button
                      key={key}
                      role="tab"
                      aria-selected={activeFilter === key}
                      className={`forum-tab ${activeFilter === key ? 'is-active' : ''}`}
                      onClick={() => setActiveFilter(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="forum-search">
                  <input
                    className="text-input forum-search-input"
                    type="text"
                    placeholder="Search discussions by topic, lesson, or keyword…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Posts */}
              <div className="forum-list">
                {displayPosts.length > 0 ? (
                  displayPosts.map((post) => (
                    <ForumPost
                      key={post.id}
                      post={{
                        id: post.id,
                        title: post.postTitle,
                        author: post.authorUID,
                        timeAgo:
                          post.id === PINNED_ID
                            ? ''
                            : formatDistanceToNow(new Date(post.ts), { addSuffix: true }),
                        replyCount: post.replies.length,
                        unseenCount: post.id === PINNED_ID ? 0 : getUnseenCount(post.id),
                        tags: [
                          { id: post.lessonTitleId, label: post.lessonTitle, type: 'primary' },
                          { id: 'subtopic', label: post.subtopicTitle, type: 'secondary' },
                        ],
                      }}
                      onPostClick={(id) => {
                        // allow opening the pinned guidance post as a thread
                        handlePostClick(id);
                      }}
                    />
                  ))
                ) : (
                  <div className="forum-empty">
                    <h3>No discussions found</h3>
                    <p>
                      {searchQuery || activeFilter !== 'all'
                        ? 'Try adjusting your filters or search terms.'
                        : 'Be the first to start a discussion!'}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.getElementById('modal-root')!
  );
};

export default ForumModal;