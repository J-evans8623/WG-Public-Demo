/**
 * @file ForumModal.tsx
 * @description
 * Refined Discussion Forum modal component that provides a modern, professional interface for browsing and managing forum discussions.
 * This component serves as the main entry point for forum interactions, displaying a filterable and searchable list of discussion posts
 * with enhanced visual hierarchy and user experience. The modal integrates seamlessly with the existing CommentContext API while
 * providing significant visual and functional improvements over the previous implementation. Features include contextual posting
 * (posts can be associated with specific slides/lessons), advanced filtering capabilities (All Topics, My Posts, Unanswered, Recent,
 * Most Discussed), real-time search functionality, and responsive design patterns. The component maintains the established brand
 * theme with sage green primary actions, blue secondary elements, and professional typography hierarchy. Integration points include
 * slideshow overlay and general forum access, with automatic tagging when launched from specific lesson contexts. The modal uses
 * React portals for proper z-index management and includes comprehensive keyboard navigation support.
 *
 * Responsibilities:
 * 1. Render the main forum interface with header, filters, search, and post list
 * 2. Manage filter state and search queries for post discovery
 * 3. Handle creation of new discussion posts via DiscussionFormInput integration
 * 4. Navigate between list view and individual thread view (DiscussionThread)
 * 5. Integrate with CommentContext for post management and real-time updates
 * 6. Provide contextual posting capabilities when launched from specific slides
 * 7. Maintain responsive design and accessibility standards
 * 8. Log critical interactions and state changes for debugging
 */

import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { formatDistanceToNow } from 'date-fns';
import { X } from 'lucide-react';
import { useComments } from '@/app/Library/Context/CommentContext';
import  ForumPost  from './comment/ForumPost';
import DiscussionThread from './DiscussionThread';
import DiscussionFormInput from './DiscussionFormInput';

interface ForumModalProps {
  initialSlideId?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

type FilterKey = 'all' | 'mine' | 'unanswered' | 'recent' | 'hot';

/**
 * @function ForumModal
 * @description
 * Main forum modal component that orchestrates the discussion forum experience. Handles the display of forum posts,
 * filtering, searching, and navigation between list and thread views. Integrates with CommentContext for data
 * management and provides a modern, accessible interface following the established brand guidelines.
 * Includes comprehensive state management for modal behavior, post filtering, and user interactions.
 */
const ForumModal: React.FC<ForumModalProps> = ({
  initialSlideId = null,
  isOpen,
  onClose,
}) => {
  // Step 1: Initialize context hooks and state management
  const commentsApi = useComments();
  const { posts, addPost, getUnseenCount } = commentsApi;
  const currentUserId = (commentsApi as any)?.currentUserId ?? null;

  // Step 2: Component state for modal behavior and UI interactions
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');

  console.log('ForumModal.tsx [FMDL1001] › Modal opened with slideId:', initialSlideId);

  // Step 3: Process and filter posts data for display
  const processedPosts = useMemo(() => {
    console.log('ForumModal.tsx [FMDL1002] › Processing posts data, total posts:', posts.size);
    
    const postArray = Array.from(posts.values());
    
    // Filter by slide context if provided
    const contextFiltered = initialSlideId 
      ? postArray.filter(p => p.resourceId === initialSlideId)
      : postArray;

    // Apply user-selected filters
    let filtered = contextFiltered;
    switch (activeFilter) {
      case 'mine':
        filtered = currentUserId ? contextFiltered.filter(p => p.authorUID === currentUserId) : contextFiltered;
        break;
      case 'unanswered':
        filtered = contextFiltered.filter(p => p.replies.length === 0);
        break;
      case 'recent':
        filtered = [...contextFiltered].sort((a, b) => b.ts - a.ts);
        break;
      case 'hot':
        filtered = [...contextFiltered].sort((a, b) => b.replies.length - a.replies.length);
        break;
      case 'all':
      default:
        break;
    }

    // Apply search filter
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter(p =>
        p.body.toLowerCase().includes(query) ||
        p.authorUID.toLowerCase().includes(query) ||
        p.lessonTitle.toLowerCase().includes(query) ||
        p.subtopicTitle.toLowerCase().includes(query)
      );
    }

    console.log('ForumModal.tsx [FMDL1003] › Filtered posts count:', filtered.length);
    return filtered;
  }, [posts, activeFilter, searchQuery, currentUserId, initialSlideId]);

  // Step 4: Handle keyboard navigation and modal behavior
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isFormOpen) {
        console.log('ForumModal.tsx [FMDL1004] › Closing modal via Escape key');
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFormOpen, onClose]);

  // Step 5: Event handlers for user interactions
  const handleStartDiscussion = () => {
    console.log('ForumModal.tsx [FMDL1005] › Opening discussion form');
    setFormOpen(true);
  };

  const handlePostCreated = (title: string, content: string) => {
    console.log('ForumModal.tsx [FMDL1006] › Creating new post with title:', title);
    addPost({
      lessonTitle: 'Discussion Forum',
      lessonTitleId: 'forum',
      subtopicTitle: 'General',
      body: content,
      postTitle:title,
      resourceId: initialSlideId || 'general',
    });
    setFormOpen(false);
  };

  const handlePostClick = (postId: string) => {
    console.log('ForumModal.tsx [FMDL1007] › Opening post thread:', postId);
    setSelectedPostId(postId);
  };

  const handleBackToList = () => {
    console.log('ForumModal.tsx [FMDL1008] › Returning to post list');
    setSelectedPostId(null);
  };

  if (!isOpen) return null;

  // Step 6: Render modal content based on current view state
  return ReactDOM.createPortal(
    <div className="forum-modal-backdrop" onClick={onClose}>
      <div
        className="forum-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="forum-title"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <header className="forum-modal__header">
          <div className="forum-modal__header-content">
            <h2 id="forum-title" className="forum-modal__title">
              Discussion Forum
            </h2>
            <div className="forum-modal__header-actions">
              {!selectedPostId && !isFormOpen && (
                <button
                  className="forum-modal__start-btn"
                  onClick={handleStartDiscussion}
                >
                  Start Discussion
                </button>
              )}
              <button
                className="forum-modal__close-btn"
                onClick={onClose}
                aria-label="Close forum"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </header>

        {/* Modal Content */}
        <div className="forum-modal__content">
          {isFormOpen ? (
            <DiscussionFormInput
              onSubmit={handlePostCreated}
              onCancel={() => setFormOpen(false)}
              contextInfo={initialSlideId ? {
                lessonTitle: 'Current Lesson',
                slideTitle: 'Current Slide'
              } : undefined}
            />
          ) : selectedPostId ? (
            <DiscussionThread
              postId={selectedPostId}
              onBack={handleBackToList}
            />
          ) : (
            <>
              {/* Filters */}
              <div className="forum-modal__filters">
                <div className="forum-modal__tabs">
                  {[
                    { key: 'all' as const, label: 'All Topics' },
                    { key: 'mine' as const, label: 'My Posts' },
                    { key: 'unanswered' as const, label: 'Unanswered' },
                    { key: 'recent' as const, label: 'Recent' },
                    { key: 'hot' as const, label: 'Most Discussed' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      className={`forum-modal__tab ${activeFilter === key ? 'forum-modal__tab--active' : ''}`}
                      onClick={() => setActiveFilter(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div className="forum-modal__search">
                <div className="forum-modal__search-container">
                  <span className="forum-modal__search-icon">🔍</span>
                  <input
                    className="forum-modal__search-input"
                    type="text"
                    placeholder="Search discussions by topic, lesson, or keyword..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Posts List */}
              <div className="forum-modal__posts">
                {processedPosts.length > 0 ? (
                  processedPosts.map(post => (
                    <ForumPost
                      key={post.id}
                      post={{
                        id: post.id,
                        title: post.postTitle,
                        author: post.authorUID,
                        timeAgo: formatDistanceToNow(new Date(post.ts), { addSuffix: true }),
                        replyCount: post.replies.length,
                        unseenCount: getUnseenCount(post.id),
                        tags: [
                          { id: post.lessonTitleId, label: post.lessonTitle, type: 'primary' },
                          { id: 'subtopic', label: post.subtopicTitle, type: 'secondary' },
                        ],
                      }}
                      onPostClick={handlePostClick}
                    />
                  ))
                ) : (
                  <div className="forum-modal__empty">
                    <div className="forum-modal__empty-icon">💬</div>
                    <h3 className="forum-modal__empty-title">No discussions found</h3>
                    <p className="forum-modal__empty-text">
                      {searchQuery || activeFilter !== 'all' 
                        ? 'Try adjusting your filters or search terms'
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