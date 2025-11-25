/**
 * DiscussionThread.tsx
 * @description
 * Thread view component implementing the Clean Divider Style prototype.
 * Follows the exact visual hierarchy:
 * 1. Back button
 * 2. Main comment head (small user info → LARGE title → normal body)
 * 3. Divider
 * 4. Reply box
 * 5. Divider
 * 6. Discussion section with compact replies
 * 
 * Uses ThreadView.css for all styling.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Send } from 'lucide-react';
import { useComments } from '@/app/Library/Context/forum/CommentContext';
import './ThreadView.css';
import { Textarea } from '@headlessui/react';

const PINNED_ID = 'system_welcome';

interface DiscussionThreadProps {
  postId: string;
  onBack: () => void;
}

const DiscussionThread: React.FC<DiscussionThreadProps> = ({ postId, onBack }) => {
  const { posts, addComment, markThreadViewed, getPostItemCount } = useComments();
  const [replyText, setReplyText] = useState('');
  const [isComposing, setIsComposing] = useState(false);

  // Resolve post; allow synthetic guidance thread
  const post = useMemo(() => {
    if (postId !== PINNED_ID) return posts.get(postId);
    return {
      id: PINNED_ID,
      postTitle: 'Stay connected with your peers',
      body:
        'Use the discussion forum to stay in contact with anyone who has access to this notebook. Invite other collaborators to start having discussions.',
      authorUID: 'System',
      ts: Date.now(),
      replies: [] as any[],
    } as any;
  }, [postId, posts]);

  const { sortedReplies, replyCount } = useMemo(() => {
    if (!post) return { sortedReplies: [], replyCount: 0 };
    const sorted = [...post.replies].sort((a, b) => a.ts - b.ts);
    return { sortedReplies: sorted, replyCount: post.replies.length };
  }, [post]);

  const handleSubmitReply = useCallback(() => {
    const t = replyText.trim();
    if (!t) return;
    addComment(postId, t);
    setReplyText('');
    setIsComposing(false);
    const size = getPostItemCount(postId);
    markThreadViewed(postId);
    console.log('[DiscussionThread] reply posted; size', size);
  }, [replyText, postId, addComment, getPostItemCount, markThreadViewed]);

  useEffect(() => {
    const size = getPostItemCount(postId);
    if (size > 0) markThreadViewed(postId);
  }, [postId, getPostItemCount, markThreadViewed, post?.replies.length]);

  if (!post) {
    return (
      <div className="thread-view__error">
        <h3>Discussion not found</h3>
        <p>This discussion may have been deleted or moved.</p>
        <button onClick={onBack} className="thread-view__back-btn">
          <ArrowLeft size={16} />
          Back to Discussions
        </button>
      </div>
    );
  }

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase() || '?';
  };

  const isPinned = post.id === PINNED_ID;

  return (
    <div className="thread-view">
      {/* Back Button */}
      <div className="thread-view__back">
        <button onClick={onBack} className="thread-view__back-btn">
          <ArrowLeft size={16} />
          Back to Discussions
        </button>
      </div>

      {/* MAIN COMMENT HEAD */}
      <div className="thread-view__main-comment">
        {/* User icon circle + user name in small font */}
        <div className="thread-view__user-row">
          <div className="thread-view__user-avatar">
            {getInitials(post.authorUID)}
          </div>
          <div className="thread-view__user-info">
            <div className="thread-view__user-name">{post.authorUID}</div>
            {!isPinned && (
              <div className="thread-view__user-time">
                {formatDistanceToNow(new Date(post.ts), { addSuffix: true })}
              </div>
            )}
          </div>
          {!isPinned && (
            <span className="thread-view__badge">Question</span>
          )}
        </div>

        {/* Post title with dominant heading */}
        <h1 className="thread-view__title">{post.postTitle}</h1>

        {/* Post body with normal text size */}
        <div className="thread-view__body">{post.body}</div>
      </div>

      {/* DIVIDER */}
      <div className="thread-view__divider" />

      {/* SLEEK REPLY BOX */}
      {!isPinned && (
        <div className="thread-view__reply-section">
          <textarea
            className="thread-view__reply-textarea"
            placeholder="Write your reply..."
            value={replyText}
            onChange={(e) => {
              setReplyText(e.target.value);
              const el = e.target as HTMLTextAreaElement;
              el.style.height = 'auto';
              el.style.height = Math.max(80, el.scrollHeight) + 'px';
            }}
            onFocus={() => setIsComposing(true)}
          />
          {isComposing ? (
            <div className="thread-view__reply-actions">
              <button
                className="thread-view__cancel-btn"
                onClick={() => {
                  setReplyText('');
                  setIsComposing(false);
                }}
              >
                Cancel
              </button>
              <button
                className="thread-view__reply-btn"
                onClick={handleSubmitReply}
                disabled={!replyText.trim()}
              >
                <Send size={16} />
                Reply
              </button>
            </div>
          ) : (
            <button
              className="thread-view__reply-btn"
              onClick={() => {
                setIsComposing(true);
                setTimeout(() => {
                  const textarea = document.querySelector('.thread-view__reply-textarea') as HTMLTextAreaElement;textarea?.focus();
                }, 100);
              }}
            >
              <Send size={16} />
              Reply
            </button>
          )}
        </div>
      )}

      {/* DIVIDER (only if there are replies) */}
      {!isPinned && replyCount > 0 && (
        <div className="thread-view__divider" />
      )}

      {/* COMMENT/REPLY THREAD SECTION */}
      {!isPinned && replyCount > 0 && (
        <div className="thread-view__discussion">
          <h2 className="thread-view__discussion-header">
            Discussion ({replyCount} {replyCount === 1 ? 'reply' : 'replies'})
          </h2>

          <div className="thread-view__replies-list">
            {sortedReplies.map((reply) => (
              <div key={reply.id} className="thread-view__reply">
                <div
                  className={`thread-view__reply-avatar ${
                    reply.authorUID === post.authorUID
                      ? 'thread-view__reply-avatar--op'
                      : ''
                  }`}
                >
                  {getInitials(reply.authorUID)}
                </div>
                <div className="thread-view__reply-content">
                  <div className="thread-view__reply-meta">
                    <span className="thread-view__reply-author">
                      {reply.authorUID}
                    </span>
                    <span className="thread-view__reply-time">
                      {formatDistanceToNow(new Date(reply.ts), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <div className="thread-view__reply-text">{reply.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pinned post nudge */}
      {isPinned && (
        <div className="thread-view__pinned-nudge">
          Use the <strong>+ New</strong> button in the top-right to start your
          first discussion.
        </div>
      )}
    </div>
  );
};

export default DiscussionThread;