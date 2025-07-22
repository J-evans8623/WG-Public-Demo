// File: app/studygraph/(studygraph)/components/forum/ForumModal.tsx
/**
 * ForumModal.tsx
 *
 * Responsibilities:
 * - Display either:
 *    • A list of all posts for the current slide (slide-scoped mode), or
 *    • A drill-down view of a single post and its replies (detail mode)
 * - Allow creating new top-level posts via CommentInputModal
 * - Transition between list view and detail view on post click
 * - Log openings, closings, and navigation events for observability
 */

import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { ForumList } from './comment/ForumPost';
import CommentInputModal from './CommentInputModal';
import ForumPostDetail from './ForumPostDetail';
import { useComments } from '@/app/Library/Context/CommentContext';
import { formatDistanceToNow } from 'date-fns';
import './ForumModal.css';

interface ForumModalProps {
  /** If provided, show posts only for this slide/resource */
  initialSlideId?: string | null;
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
}

const ForumModal: React.FC<ForumModalProps> = ({
  initialSlideId = null,
  isOpen,
  onClose,
}) => {
  const { posts, addPost, addComment } = useComments();
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [isComposerVisible, setComposerVisible] = useState(false);

  // Log open/close
  useEffect(() => {
    if (!isOpen) return;
    console.log(`ForumModal.tsx [FMOD0001] › opened (${initialSlideId ? `slide ${initialSlideId}` : 'global'})`);
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        console.log('ForumModal.tsx [FMOD0002] › Escape pressed, closing modal');
        onClose();
      }
    };
    document.addEventListener('keydown', escHandler);
    return () => {
      console.log('ForumModal.tsx [FMOD0003] › removing key listener');
      document.removeEventListener('keydown', escHandler);
    };
  }, [isOpen, initialSlideId, onClose]);

  if (!isOpen) return null;

  // Build forum data for list or slide
  const forumData = Array.from(posts.values())
    .filter(post => !initialSlideId || post.resourceId === initialSlideId)
    .map(post => ({
      id: post.id,
      title: post.body,
      tags: [
        { id: post.lessonTitleId, label: post.lessonTitle, type: 'primary' as const },
        { id: post.subtopicTitle, label: post.subtopicTitle, type: 'secondary' as const },
      ],
      author: post.authorUID,
      timeAgo: formatDistanceToNow(new Date(post.ts), { addSuffix: true }),
      replyCount: post.replies.length,
    }));

  return ReactDOM.createPortal(
    <div className="forum-modal-backdrop" onClick={onClose}>
      <div
        className="forum-modal"
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
      >
        {detailPostId ? (
          // ── Detail view ──
          <ForumPostDetail
            postId={detailPostId}
            onClose={() => {
              console.log('ForumModal.tsx [FMOD0004] › closing detail view for post', detailPostId);
              setDetailPostId(null);
            }}
            onReply={(parentId, body) => {
              console.log('ForumModal.tsx [FMOD0005] › adding reply to', parentId, body);
              addComment(parentId, body);
            }}
          />
        ) : (
          // ── List view ──
          <React.Fragment>
            <ForumList
              posts={forumData}
              onPostClick={id => {
                console.log('ForumModal.tsx [FMOD0006] › drill into post', id);
                setDetailPostId(id);
              }}
              onNewPost={initialSlideId ? () => {
                console.log('ForumModal.tsx [FMOD0007] › showing composer');
                setComposerVisible(true);
              } : undefined}
            />
            {isComposerVisible && initialSlideId && (
              <CommentInputModal
                slideId={initialSlideId}
                onPost={(_, body) => {
                  console.log('ForumModal.tsx [FMOD0008] › creating new post on slide', initialSlideId, body);
                  addPost({
                    lessonTitle: '',
                    lessonTitleId: '',
                    subtopicTitle: '',
                    resourceId: initialSlideId,
                    body,
                  });
                  setComposerVisible(false);
                }}
                onClose={() => {
                  console.log('ForumModal.tsx [FMOD0009] › hiding composer');
                  setComposerVisible(false);
                }}
              />
            )}
          </React.Fragment>
        )}
      </div>
    </div>,
    document.getElementById('modal-root')!
  );
};

export default ForumModal;
