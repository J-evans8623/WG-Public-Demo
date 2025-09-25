/**
 * @file DiscussionThread.tsx
 * @description
 * Comprehensive discussion thread view component that displays a complete forum discussion including the original post
 * and all associated replies. This component provides an enhanced user experience for viewing and participating in
 * forum discussions with clear visual hierarchy, professional styling, and intuitive interaction patterns. The design
 * emphasizes the original post as the central focus while presenting replies in a clean, readable format. Features
 * include sophisticated styling for the original post with gradient backgrounds and borders, clear distinction between
 * original author replies and other user contributions, integrated reply composition functionality, and comprehensive
 * engagement metrics. The component maintains the established brand theme with sage green primary actions, blue
 * secondary elements, and professional typography throughout. Reply functionality includes real-time composition with
 * auto-expanding textareas, form validation, and seamless integration with the CommentContext API. The interface
 * supports both mouse and keyboard navigation, includes proper accessibility features, and provides visual feedback
 * for all interactive elements. The component is designed to handle various discussion sizes efficiently while
 * maintaining optimal performance and user experience.
 *
 * Responsibilities:
 * 1. Display the original discussion post with enhanced visual prominence and metadata
 * 2. Render all replies in chronological order with clear author identification
 * 3. Distinguish original poster replies with special visual indicators and styling
 * 4. Provide integrated reply composition functionality with form validation
 * 5. Handle real-time updates from CommentContext for new replies and post changes
 * 6. Implement engagement statistics and interaction metrics display
 * 7. Support keyboard navigation and accessibility features throughout the interface
 * 8. Maintain responsive design for optimal viewing across different screen sizes
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { useComments } from '@/app/Library/Context/CommentContext';

interface DiscussionThreadProps {
  postId: string;
  onBack: () => void;
}

/**
 * @function DiscussionThread
 * @description
 * Main discussion thread component that orchestrates the display of a complete forum discussion. Manages the
 * presentation of the original post, all replies, and reply composition functionality. Integrates with CommentContext
 * for data management and real-time updates. Provides comprehensive user interaction capabilities including reply
 * creation, author identification, and navigation controls. The component maintains optimal performance through
 * memoization and efficient re-rendering patterns while ensuring accessibility and responsive design.
 */
const DiscussionThread: React.FC<DiscussionThreadProps> = ({ postId, onBack }) => {
  // Step 1: Initialize context and state management
  const { posts, addComment, markThreadViewed, getPostItemCount } = useComments();
  const [replyText, setReplyText] = useState('');
  const [isComposing, setIsComposing] = useState(false);



  console.log('DiscussionThread.tsx [DTHR1001] › Loading thread for post:', postId);

  // Step 2: Retrieve and validate post data
  const post = posts.get(postId);
  
      // Step 3: Process replies and engagement data
   const { sortedReplies, replyCount, viewCount } = useMemo(() => {
    if (!post) {
      return {
        sortedReplies: [],
        replyCount: 0,
        viewCount: 0
      };
    }

    const sorted = [...post.replies].sort((a, b) => a.ts - b.ts);
    console.log('DiscussionThread.tsx [DTHR1003] › Processed', sorted.length, 'replies');
    
    return {
      sortedReplies: sorted,
      replyCount: post.replies.length,
      viewCount: 24 // Mock view count - would come from analytics
    };
  }, [post]);

  
  // after you submit a reply, also mark as viewed so your own reply isn't "unseen" ──
const handleSubmitReply = useCallback(() => {
  const trimmedReply = replyText.trim();
  if (!trimmedReply) return;

  console.log('DiscussionThread.tsx [DTHR1004] › Submitting reply to post:', postId);
  addComment(postId, trimmedReply);
  setReplyText('');
  setIsComposing(false);

  // Step 1: after add, recompute and mark seen
  const size = getPostItemCount(postId);
  markThreadViewed(postId);
  console.log('DiscussionThread.tsx [DTHR1102] › markThreadViewed after own reply', { postId, size });
}, [replyText, postId, addComment, getPostItemCount, markThreadViewed]); 


  // ── update - 3: mark the thread as viewed on mount and whenever it grows while open ──
useEffect(() => {
  // Step 1: if post exists, compute current size
  const size = getPostItemCount(postId);
  // Step 2: persist "seen up to now" so badges clear predictably
  if (size > 0) markThreadViewed(postId);
  console.log('DiscussionThread.tsx [DTHR1101] › markThreadViewed on open/grow', { postId, size });
  // Re-run when reply count changes
}, [postId, getPostItemCount, markThreadViewed, post?.replies.length])

  if (!post) {
    console.log('DiscussionThread.tsx [DTHR1002] › Post not found:', postId);
    return (
      <div className="discussion-thread__error">
        <h3>Discussion not found</h3>
        <p>This discussion may have been deleted or moved.</p>
        <button onClick={onBack} className="discussion-thread__back-btn">
          <ArrowLeft size={16} />
          Back to Discussions
        </button>
      </div>
    );
  }



  // Step 5: Handle textarea auto-expansion
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setReplyText(e.target.value);
    // Auto-expand textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(100, textarea.scrollHeight) + 'px';
  };

  // Step 6: Generate user initials for avatars
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
    return (first + last).toUpperCase() || '?';
  };

  // Step 7: Render the complete discussion thread
  return (
    <div className="discussion-thread">
      {/* Back Navigation */}
      <header className="discussion-thread__header">
        <button onClick={onBack} className="discussion-thread__back-btn">
          <ArrowLeft size={16} />
          Back to Discussions
        </button>
      </header>

      {/* Original Post Section */}
      <section className="discussion-thread__original-post">
        <div className="discussion-thread__post-header">
          <div className="discussion-thread__post-title-row">
            <h1 className="discussion-thread__post-title">
              {post.postTitle}
            </h1>
            <span className="discussion-thread__post-badge">Question</span>
          </div>
          <div className="discussion-thread__post-meta">
            <div className="discussion-thread__author-info">
              <div className="discussion-thread__author-avatar">
                {getInitials(post.authorUID)}
              </div>
              <span className="discussion-thread__author-name">{post.authorUID}</span>
            </div>
            <span className="discussion-thread__post-timestamp">
              {formatDistanceToNow(new Date(post.ts), { addSuffix: true })}
            </span>
          </div>
        </div>

        <div className="discussion-thread__post-content">
          <div className="discussion-thread__post-text">
            {post.body}
          </div>
          <div className="discussion-thread__post-actions">
            <button
              className="discussion-thread__reply-btn"
              onClick={() => {
                setIsComposing(true);
                setTimeout(() => {
                  const textarea = document.querySelector('.discussion-thread__reply-textarea') as HTMLTextAreaElement;
                  textarea?.focus();
                }, 100);
              }}
            >
               Reply
            </button>
            <div className="discussion-thread__engagement-stats">
              <div className="discussion-thread__stat-item">

              </div>
              <div className="discussion-thread__stat-item">
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Replies Section */}
      <section className="discussion-thread__replies">
        <div className="discussion-thread__section-header">
          <h2 className="discussion-thread__section-title">Discussion</h2>
          <span className="discussion-thread__replies-count">{replyCount} replies</span>
        </div>

        <div className="discussion-thread__replies-list">
          {sortedReplies.map((reply) => (
            <article
              key={reply.id}
              className={`discussion-thread__reply ${
                reply.authorUID === post.authorUID ? 'discussion-thread__reply--original-author' : ''
              }`}
            >
              {reply.authorUID === post.authorUID && (
                <span className="discussion-thread__op-badge">OP</span>
              )}
              <div className="discussion-thread__reply-header">
                <div
                  className={`discussion-thread__reply-avatar ${
                    reply.authorUID === post.authorUID ? 'discussion-thread__reply-avatar--op' : ''
                  }`}
                >
                  {getInitials(reply.authorUID)}
                </div>
                <div className="discussion-thread__reply-meta">
                  <div className="discussion-thread__reply-author">{reply.authorUID}</div>
                  <div className="discussion-thread__reply-timestamp">
                    {formatDistanceToNow(new Date(reply.ts), { addSuffix: true })}
                  </div>
                </div>
              </div>
              <div className="discussion-thread__reply-content">
                {reply.body}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Reply Composition Section */}
      <section className="discussion-thread__compose">
        <div className="discussion-thread__compose-header">
          <div className="discussion-thread__current-user-avatar">YU</div>
          <div className="discussion-thread__reply-prompt">Add your reply to this discussion</div>
        </div>
        <textarea
          className="discussion-thread__reply-textarea"
          placeholder="Share your thoughts, advice, or ask follow-up questions..."
          value={replyText}
          onChange={handleTextareaChange}
          onFocus={() => setIsComposing(true)}
        />
        {isComposing && (
          <div className="discussion-thread__compose-actions">
            <button
              className="discussion-thread__cancel-btn"
              onClick={() => {
                setReplyText('');
                setIsComposing(false);
              }}
            >
              Cancel
            </button>
            <button
              className="discussion-thread__submit-btn"
              onClick={handleSubmitReply}
              disabled={!replyText.trim()}
            >
              Post Reply
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default DiscussionThread;