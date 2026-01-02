// DiscussionThread.tsx

/**
 * DiscussionThread.tsx
 * @description
 * Thread view component implementing the Clean Divider Style prototype.
 * Includes functionality for owners to edit their original post.
 * * Updates:
 * - Fixed layout causing badge to shift to center.
 * - Standardized Edit Form styling using modalStyles.css and branded-forum.css.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Send, Pencil, X, Check } from 'lucide-react';
import { useComments } from '@/app/Library/Context/forum/CommentContext';
import './ThreadView.css';

// We assume modalStyles.css and branded-forum.css are loaded globally 
// or by the parent ForumModal, making classes like .text-input and .icon-btn available.

const PINNED_ID = 'system_welcome';

interface DiscussionThreadProps {
  postId: string;
  onBack: () => void;
}

const DiscussionThread: React.FC<DiscussionThreadProps> = ({ postId, onBack }) => {
  // 1. Context Hooks
  const { 
    posts, 
    addComment, 
    markThreadViewed, 
    getPostItemCount, 
    editPost, 
    currentUserId 
  } = useComments();

  // 2. Local State
  const [replyText, setReplyText] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Edit Form State
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');

  // 3. Resolve Post Data
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

  // 4. Ownership Check
  const isOwner = post && post.authorUID === currentUserId && post.id !== PINNED_ID;

  // 5. Handlers
  const handleStartEdit = () => {
    if (!post) return;
    setEditTitle(post.postTitle);
    setEditBody(post.body);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle('');
    setEditBody('');
  };

  const handleSaveEdit = () => {
    if (!editTitle.trim() || !editBody.trim()) return;
    editPost(postId, editTitle.trim(), editBody.trim());
    setIsEditing(false);
  };

  const handleSubmitReply = useCallback(() => {
    const t = replyText.trim();
    if (!t) return;
    addComment(postId, t);
    setReplyText('');
    setIsComposing(false);
    
    // Update view counters
    const size = getPostItemCount(postId);
    markThreadViewed(postId);
    console.log('[DiscussionThread] reply posted; size', size);
  }, [replyText, postId, addComment, getPostItemCount, markThreadViewed]);

  // 6. Effects
  useEffect(() => {
    const size = getPostItemCount(postId);
    if (size > 0) markThreadViewed(postId);
  }, [postId, getPostItemCount, markThreadViewed, post?.replies.length]);

  // 7. Memoized Replies
  const { sortedReplies, replyCount } = useMemo(() => {
    if (!post) return { sortedReplies: [], replyCount: 0 };
    const sorted = [...post.replies].sort((a, b) => a.ts - b.ts);
    return { sortedReplies: sorted, replyCount: post.replies.length };
  }, [post]);

  // Helper
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase() || '?';
  };

  // Guard Clause
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

  const isPinned = post.id === PINNED_ID;

  return (
    <div className="thread-view">
      {/* 1. Navigation */}
      <div className="thread-view__back">
        <button onClick={onBack} className="thread-view__back-btn">
          <ArrowLeft size={16} />
          Back to Discussions
        </button>
      </div>

      {/* 2. Main Post Area */}
      <div className="thread-view__main-comment">
        {/* User Row Header */}
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
          
          {/* LAYOUT FIX: 
             The Badge uses 'margin-left: auto' in CSS. 
             Placing the Edit button AFTER the badge ensures both stay to the right,
             and the badge doesn't get pushed to the center.
          */}
          {!isPinned && (
            <span className="thread-view__badge">Question</span>
          )}

          {isOwner && !isEditing && (
            <button 
              className="icon-btn" 
              onClick={handleStartEdit}
              title="Edit Post"
              style={{ marginLeft: '8px' }}
            >
              <Pencil size={16} />
            </button>
          )}
        </div>

        {/* Content Area: Switches between Read Mode and Edit Mode */}
        {isEditing ? (
          <div className="form-section" style={{ marginTop: '16px' }}>
            {/* Title Input - styled to look like a title */}
            <input
              className="text-input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Discussion Title"
              autoFocus
              style={{ 
                fontSize: '24px', 
                fontWeight: 600, 
                marginBottom: '16px',
                padding: '12px'
              }}
            />
            
            {/* Body Textarea */}
            <textarea
              className="text-input"
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              placeholder="What's on your mind?"
              rows={6}
              style={{ 
                resize: 'vertical', 
                minHeight: '120px',
                lineHeight: '1.6',
                fontFamily: 'inherit'
              }}
            />

            {/* Edit Actions Footer */}
            <div className="button-section" style={{ marginTop: '16px' }}>
              <button 
                className="btn btn-cancel" 
                onClick={handleCancelEdit}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <X size={14} /> Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleSaveEdit}
                disabled={!editTitle.trim() || !editBody.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Check size={14} /> Save Changes
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="thread-view__title">{post.postTitle}</h1>
            <div className="thread-view__body">{post.body}</div>
          </>
        )}
      </div>

      {/* 3. Divider */}
      <div className="thread-view__divider" />

      {/* 4. Reply Composer */}
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
                  const textarea = document.querySelector('.thread-view__reply-textarea') as HTMLTextAreaElement;
                  textarea?.focus();
                }, 100);
              }}
            >
              <Send size={16} />
              Reply
            </button>
          )}
        </div>
      )}

      {/* 5. Reply List Divider */}
      {!isPinned && replyCount > 0 && (
        <div className="thread-view__divider" />
      )}

      {/* 6. Discussion List */}
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

      {/* Pinned Nudge */}
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