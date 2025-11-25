/**
 * @file ForumPostDetail.tsx
 * @description
 *   Thread view for a single forum post with a robust, overlay-based reply flow. The original
 *   post and replies render inside the scroll content. The reply composer is not sticky inside
 *   the scroller; it is rendered into the modal’s bottom overlay via React Portal using the
 *   provided `composerPortalId`. This guarantees the composer truly sits on top of content, and
 *   a ResizeObserver in the modal ensures the scroller’s bottom padding always matches the live
 *   height of the composer, even as the textarea grows. Drafts persist per post in localStorage
 *   and are cleared only on successful submit. Logging focuses on mount, draft detection, open/
 *   close transitions, and submit success using file+4-digit codes for quick tracing.
 *
 * Responsibilities:
 *   1) Render post body + replies with accessible semantics and tokenized visuals.
 *   2) Manage a collapsed-by-default reply flow and portal the composer to the bottom overlay.
 *   3) Persist drafts per post and clear drafts only after successful submission.
 *   4) Emit concise logs at key UI checkpoints to aid debugging.
 */

import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useComments } from '@/app/Library/Context/forum/CommentContext';
import './ForumPostDetail.css';

interface ForumPostDetailProps {
  /** ID of the post to display */
  postId: string;
  /** Close detail view */
  onClose: () => void;
  /** Handler to add a reply */
  onReply: (parentId: string, body: string) => void;
  /** Hide internal close button if the parent renders its own header actions */
  hideClose?: boolean;
  /** ID of the modal-owned element where the composer should be portaled */
  composerPortalId?: string;
}

/**
 * @function getInitials
 * @description
 *   Convert a display name into a two-letter initials string. Handles stray whitespace and single
 *   word names. Uppercases for consistent contrast. Kept local to avoid cross-module dependencies.
 */
function getInitials(name: string) {
  const parts = (name || '').trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

const ForumPostDetail: React.FC<ForumPostDetailProps> = ({
  postId,
  onClose,
  onReply,
  hideClose = false,
  composerPortalId = 'forum-composer-overlay',
}) => {
  // 1) Data lookup
  const { posts } = useComments();
  const post = posts.get(postId);
  const opInitials = getInitials(post?.authorUID || '');

  // 2) Reply state + refs
  const [replyBody, setReplyBody] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 3) Draft key scoped to post
  const draftKey = `forum-reply-draft:${postId}`;

  // 4) Mount + draft detection
  useEffect(() => {
    console.log('ForumPostDetail.tsx [FPDT1000] › mount, postId =', postId);
    const saved = localStorage.getItem(draftKey);
    const exists = !!(saved && saved.trim());
    setHasDraft(exists);
    if (exists) console.log('ForumPostDetail.tsx [FPDT1001] › detected saved draft, length =', saved!.length);
  }, [draftKey, postId]);

  // 5) Focus textarea on open/close
  useEffect(() => {
    if (composerOpen) {
      textareaRef.current?.focus();
      console.log('ForumPostDetail.tsx [FPDT1002] › composer opened (overlay), focusing textarea');
    } else {
      console.log('ForumPostDetail.tsx [FPDT1003] › composer closed');
    }
  }, [composerOpen]);

  if (!post) return null;

  // 6) Handlers
  const openComposer = () => {
    if (!replyBody.trim()) {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        setReplyBody(saved);
        console.log('ForumPostDetail.tsx [FPDT1004] › restored draft into editor, length =', saved.length);
      }
    }
    setComposerOpen(true);
    console.log('ForumPostDetail.tsx [FPDT1005] › composer opening');
  };

  const handleChange = (v: string) => {
    setReplyBody(v);
    const trimmed = v.trim();
    if (trimmed) {
      localStorage.setItem(draftKey, v);
      if (!hasDraft) setHasDraft(true);
      if (v.length === trimmed.length && v.length === 1) {
        console.log('ForumPostDetail.tsx [FPDT1006] › first character typed, draft started');
      }
    } else {
      localStorage.removeItem(draftKey);
      if (hasDraft) console.log('ForumPostDetail.tsx [FPDT1007] › draft cleared (empty input)');
      setHasDraft(false);
    }
  };

  const submitReply = () => {
    const trimmed = replyBody.trim();
    if (!trimmed) {
      console.log('ForumPostDetail.tsx [FPDT1008] › submit blocked (empty reply)');
      return;
    }
    console.log('ForumPostDetail.tsx [FPDT1009] › submitting reply', { postId, chars: trimmed.length });
    onReply(postId, trimmed);
    localStorage.removeItem(draftKey);
    setHasDraft(false);
    setReplyBody('');
    setComposerOpen(false);
    console.log('ForumPostDetail.tsx [FPDT1010] › submit success, draft cleared, composer closed');
  };

  const cancelComposer = () => {
    setComposerOpen(false);
    console.log('ForumPostDetail.tsx [FPDT1011] › composer cancelled, draft preserved');
  };

  // 7) Composer element (rendered into bottom overlay via portal)
  const composerEl = composerOpen ? (
    <div className="forum-detail__composer forum-detail__composer--overlay">
      <textarea
        ref={textareaRef}
        className="field forum-detail__textarea"
        value={replyBody}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Write your comment… Use @ to mention someone"
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); cancelComposer(); }
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply(); }
        }}
      />
      <div className="forum-detail__actions">
        <span className="hint">
          {hasDraft ? 'Draft saved locally' : 'Use @ to mention other participants'}
        </span>
        <div className="forum-detail__buttons">
          <button className="btn btn--border" onClick={cancelComposer}>Cancel</button>
          <button className="btn btn--success" onClick={submitReply} disabled={!replyBody.trim()}>
            Post Comment
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <aside
      className={`forum-detail ${composerOpen ? 'is-composer-open' : ''}`}
      role="complementary"
      aria-label="Post detail"
    >
      {!hideClose && (
        <button
          className="forum-detail__close btn btn--icon btn--border"
          onClick={() => { console.log('ForumPostDetail.tsx [FPDT1012] › close detail requested'); onClose(); }}
          aria-label="Close detail"
          title="Close"
        >
          <X size={18} />
        </button>
      )}

      {/* Original Post */}
      <div className="forum-detail__op">
        <div className="forum-detail__op-title">Original Post</div>
        <p className="forum-detail__op-body">{post.body}</p>

        <div className="forum-detail__meta">
          <div className="avatar" aria-hidden>{opInitials}</div>
          <div className="meta-stack">
            <span className="name">{post.authorUID}</span>
            <span className="time">
              {formatDistanceToNow(new Date(post.ts), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>

      {/* Replies */}
      <div className="forum-detail__replies">
        {post.replies.map((r) => (
          <div key={r.id} className="reply">
            <div className="reply__header">
              <div className="reply__avatar" aria-hidden>{getInitials(r.authorUID || '')}</div>
              <div className="reply__metastack">
                <span className="reply__name">{r.authorUID}</span>
                <span className="reply__time">
                  {formatDistanceToNow(new Date(r.ts), { addSuffix: true })}
                </span>
              </div>
            </div>
            <p className="reply__body">{r.body}</p>
          </div>
        ))}
      </div>

      {/* Floating action buttons (stay in scroller; open overlay composer) */}
      {!composerOpen && (
        <div className="forum-reply-fab-wrap">
          <button
            className="forum-reply-fab btn btn--success"
            onClick={openComposer}
            title="Write a reply"
            aria-label="Write a reply"
          >
            Reply
          </button>
          {hasDraft && (
            <button
              className="forum-reply-restore btn btn--border"
              onClick={openComposer}
              title="Restore your saved draft"
              aria-label="Restore your saved draft"
            >
              Restore draft
            </button>
          )}
        </div>
      )}

      {/* Portal composer to the modal’s bottom overlay */}
      {composerOpen &&
        typeof document !== 'undefined' &&
        ReactDOM.createPortal(
          composerEl,
          document.getElementById(composerPortalId) as HTMLElement
        )}
    </aside>
  );
};

export default ForumPostDetail;
