import React, { useMemo } from 'react';
import { MessageSquare } from 'lucide-react';
import './ForumPost.css';

export interface Tag {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'accent';
}

export interface ForumPostData {
  id: string;
  title: string;
  tags: Tag[];
  author: string;
  timeAgo: string;
  replyCount: number;
}

interface ForumPostProps {
  post: ForumPostData;
  onPostClick?: (postId: string) => void;
}

interface ForumListProps {
  posts: ForumPostData[];
  onPostClick?: (postId: string) => void;
  onNewPost?: () => void;
  onFilterByMap?: () => void;
}

function useInitials(name: string) {
  return useMemo(() => {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
    return (first + last).toUpperCase();
  }, [name]);
}

export const ForumPost: React.FC<ForumPostProps> = ({ post, onPostClick }) => {
  const initials = useInitials(post.author);

  const handleActivate = () => onPostClick?.(post.id);
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleActivate();
    }
  };

  return (
    <article
      className="forum-card"
      role="button"
      tabIndex={0}
      aria-label={`Open discussion: ${post.title}`}
      onClick={handleActivate}
      onKeyDown={handleKey}
    >
      <div className="forum-card__tags">
        {post.tags.map((tag) => (
          <span key={tag.id} className={`chip forum-tag forum-tag--${tag.type}`}>
            {tag.label}
          </span>
        ))}
      </div>

      <h3 className="forum-card__title">{post.title}</h3>

      <div className="forum-card__footer">
        <div className="forum-card__author">
          <div className="forum-card__avatar" aria-hidden>{initials}</div>
          <span className="forum-card__authorline">
            {post.author} • {post.timeAgo}
          </span>
        </div>

        <div className="forum-card__stats" aria-label={`${post.replyCount} replies`}>
          <MessageSquare size={16} aria-hidden />
          <span className="forum-card__count">
            {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'}
          </span>
        </div>
      </div>
    </article>
  );
};

export const ForumList: React.FC<ForumListProps> = ({
  posts,
  onPostClick,
  onNewPost,
  onFilterByMap,
}) => {
  return (
    <div className="forum-list">
      {(onNewPost || onFilterByMap) && (
        <div className="forum-list__actions">
          {onNewPost && (
            <button className="btn btn--success" onClick={onNewPost}>
              + Start Discussion
            </button>
          )}
          {onFilterByMap && (
            <button className="btn btn--border" onClick={onFilterByMap}>
              Filter by Map
            </button>
          )}
        </div>
      )}

      <div className="forum-list__items">
        {posts.map((post) => (
          <ForumPost key={post.id} post={post} onPostClick={onPostClick} />
        ))}
      </div>

      {posts.length === 0 && (
        <div className="forum-list__empty">
          No posts yet. Be the first to start a discussion!
        </div>
      )}
    </div>
  );
};

/** Example kept for local dev; safe to remove in prod
export const ForumExample: React.FC = () => { ... }
*/
