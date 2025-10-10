/**
 * DiscussionThread.tsx (branded thread + pinned guidance handling)
 * - Visuals aligned to branded-forum.css clean divider style
 * - Hides composer when viewing the synthetic guidance thread
 * - Removes all borders, uses clean dividers for separation
 * - Follows branded color palette and typography
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { useComments } from '@/app/Library/Context/forum/CommentContext';

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

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase() || '?';
  };

  const isPinned = post.id === PINNED_ID;

  return (
    <div className="discussion-thread">
      <header className="discussion-thread__header">
        <button onClick={onBack} className="discussion-thread__back-btn">
          <ArrowLeft size={16} />
          Back to Discussions
        </button>
      </header>

      {/* Original post */}
      <section className="discussion-thread__original-post">
        <div className="discussion-thread__post-header">
          <div className="discussion-thread__post-title-row">
            <h1 className="discussion-thread__post-title">{post.postTitle}</h1>
            {!isPinned && <span className="discussion-thread__post-badge">Question</span>}
          </div>
          <div className="discussion-thread__post-meta">
            <div className="discussion-thread__author-info">
              <div className="discussion-thread__author-avatar">{getInitials(post.authorUID)}</div>
              <span className="discussion-thread__author-name">{post.authorUID}</span>
            </div>
            {!isPinned && (
              <span className="discussion-thread__post-timestamp">
                {formatDistanceToNow(new Date(post.ts), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>

        <div className="discussion-thread__post-content">
          <div className="discussion-thread__post-text">{post.body}</div>
          {!isPinned && (
            <div className="discussion-thread__post-actions">
              <button
                className="discussion-thread__reply-btn"
                onClick={() => {
                  setIsComposing(true);
                  setTimeout(() => {
                    const textarea = document.querySelector(
                      '.discussion-thread__reply-textarea'
                    ) as HTMLTextAreaElement;
                    textarea?.focus();
                  }, 100);
                }}
              >
                Reply
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Replies */}
      {!isPinned && replyCount > 0 && (
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
                <div className="discussion-thread__reply-content">{reply.body}</div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Composer */}
      {!isPinned && (
        <section className="discussion-thread__compose">
          <div className="discussion-thread__compose-header">
            <div className="discussion-thread__reply-prompt">Add your reply to this discussion</div>
          </div>
          <textarea
            className="discussion-thread__reply-textarea"
            placeholder="Share your thoughts, advice, or ask follow-up questions..."
            value={replyText}
            onChange={(e) => {
              setReplyText(e.target.value);
              const el = e.target as HTMLTextAreaElement;
              el.style.height = 'auto';
              el.style.height = Math.max(100, el.scrollHeight) + 'px';
            }}
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
      )}

      {/* Gentle nudge when pinned thread is open */}
      {isPinned && (
        <div className="pinned-nudge">
          Use the <strong>+ New</strong> button in the top-right to start your first discussion.
        </div>
      )}
    </div>
  );
};

export default DiscussionThread;