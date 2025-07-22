// File: app/studygraph/(studygraph)/components/forum/ForumPostDetail.tsx
/**
 * ForumPostDetail.tsx
 *
 * Responsibilities:
 * - Show a single post’s full body and metadata
 * - List each reply with author and timestamp
 * - Provide an inline composer for adding replies
 * - Log view and reply events for observability
 */

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useComments } from '@/app/Library/Context/CommentContext';
import './ForumPostDetail.css';

interface ForumPostDetailProps {
  /** ID of the post to display */
  postId: string;
  /** Close detail view */
  onClose: () => void;
  /** Handler to add a reply */
  onReply: (parentId: string, body: string) => void;
}

const ForumPostDetail: React.FC<ForumPostDetailProps> = ({
  postId,
  onClose,
  onReply,
}) => {
  const { posts } = useComments();
  const post = posts.get(postId);
  const [replyBody, setReplyBody] = useState('');

  // Log initial load
  useEffect(() => {
    console.log('ForumPostDetail.tsx [FPDT0010] › loaded detail for post', postId);
  }, [postId]);

  if (!post) return null;

  const submitReply = () => {
    const trimmed = replyBody.trim();
    if (!trimmed) return;
    console.log('ForumPostDetail.tsx [FPDT0011] › submitting reply', postId, trimmed);
    onReply(postId, trimmed);
    setReplyBody('');
  };

  return (
    <aside className="forum-post-detail" role="complementary" aria-label="Post detail">
      <button
        className="close-btn"
        onClick={() => {
          console.log('ForumPostDetail.tsx [FPDT0012] › close detail view');
          onClose();
        }}
        aria-label="Close detail"
      >
        <X />
      </button>

      {/* Original post */}
      <div className="post-body">
        <strong>Original Post:</strong>
        <p>{post.body}</p>
        <div className="post-meta">
          <span className="author">{post.authorUID}</span>
          <span className="timestamp">
            {formatDistanceToNow(new Date(post.ts), { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Replies */}
      <div className="replies">
        {post.replies.map(r => (
          <div key={r.id} className="reply-item">
            <div className="reply-meta">
              <span className="author">{r.authorUID}</span>
              <span className="timestamp">
                {formatDistanceToNow(new Date(r.ts), { addSuffix: true })}
              </span>
            </div>
            <p className="reply-body">{r.body}</p>
          </div>
        ))}
      </div>

      {/* Inline composer */}
      <textarea
        className="reply-textarea"
        value={replyBody}
        onChange={e => setReplyBody(e.target.value)}
        placeholder="Write a reply…"
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitReply();
          }
        }}
      />
      <button
        className="btn-reply"
        onClick={submitReply}
        disabled={!replyBody.trim()}
      >
        Reply
      </button>
    </aside>
  );
};

export default ForumPostDetail;
