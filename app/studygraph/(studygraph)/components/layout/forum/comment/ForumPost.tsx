/**
 * @file ForumPost.tsx
 * @description
 * Individual forum post component designed for display within the forum post list. This component represents a single
 * discussion thread preview with enhanced visual hierarchy, professional styling, and interactive capabilities.
 * The component displays essential post metadata including title, author information, timestamp, reply count, and
 * contextual tags while maintaining optimal readability and accessibility. Built to integrate seamlessly with the
 * refined forum modal design, it features hover states, keyboard navigation support, and responsive behavior.
 * The design follows the established brand theme with sage green and blue accent colors, professional typography,
 * and subtle visual effects that enhance the user experience. Each post card includes avatar generation from
 * usernames, tag categorization for easy content organization, and clear visual indicators for engagement metrics.
 * The component is optimized for performance with memoized calculations and efficient re-rendering patterns.
 * Accessibility features include proper ARIA labels, keyboard navigation support, and screen reader compatibility.
 * Visual states include normal, hover, and focus indicators to provide clear feedback for user interactions.
 *
 * Responsibilities:
 * 1. Display post title, author, timestamp, and engagement metrics in a visually appealing card format
 * 2. Generate and display user avatars from username initials with consistent styling
 * 3. Render contextual tags with appropriate color coding (primary/secondary)
 * 4. Handle click interactions to navigate to full thread view
 * 5. Provide keyboard navigation support for accessibility
 * 6. Apply hover and focus states for interactive feedback
 * 7. Maintain responsive design for various screen sizes
 * 8. Integrate seamlessly with parent ForumModal component
 */

import React, { useMemo } from 'react';
import { MessageSquare } from 'lucide-react';
import "./ForumPost.css"
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
   unseenCount?: number;
}

interface ForumPostProps {
  post: ForumPostData;
  onPostClick?: (postId: string) => void;
}

/**
 * @function useInitials
 * @description
 * Custom hook that generates user initials from a full name string. Handles various name formats
 * including single names, multiple names, and edge cases. Returns uppercase initials for consistent
 * display in avatar components. Optimized with useMemo to prevent unnecessary recalculations.
 */
function useInitials(name: string): string {
  return useMemo(() => {
    console.log('ForumPost.tsx [FPST1001] › Generating initials for:', name);
    
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
    const initials = (first + last).toUpperCase();
    
    return initials || '?';
  }, [name]);
}

/**
 * @function ForumPost
 * @description
 * Renders an individual forum post card with all essential metadata and interactive capabilities.
 * The component displays post information in a structured, visually appealing format while maintaining
 * accessibility standards and responsive behavior. Includes hover states, keyboard navigation, and
 * proper semantic markup for screen readers. Integrates with parent components through click handlers
 * and maintains consistent styling with the overall forum design system.
 */
const ForumPost: React.FC<ForumPostProps> = ({ post, onPostClick }) => {
  // Step 1: Generate user initials for avatar display
  const initials = useInitials(post.author);

  // Step 2: Handle post activation through clicks or keyboard
  const handleActivate = () => {
    console.log('ForumPost.tsx [FPST1002] › Post activated:', post.id);
    onPostClick?.(post.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleActivate();
    }
  };

  // Step 3: Render the post card with all components
  return (
    <article
      className="forum-post"
      role="button"
      tabIndex={0}
      aria-label={`Open discussion: ${post.title}`}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
    >
      {/* Post Header with Tags */}
      <div className="forum-post__header forum-post__header--has-badge">
        <div className="forum-post__tags">
          {post.tags
            .filter(tag => tag.label && tag.label.trim() !== '')
            .map((tag) => (
              <span
                key={tag.id}
                className={`forum-post__tag forum-post__tag--${tag.type}`}
              >
                {tag.label}
              </span>
            ))}
        </div>
       {typeof post.unseenCount === 'number' && post.unseenCount > 0 && (
    <span
      className="forum-post__badge forum-post__badge--amber"
      aria-label={`${post.unseenCount} new ${post.unseenCount === 1 ? 'message' : 'messages'}`}
    >
      {post.unseenCount > 19 ? '19+' : post.unseenCount} {/* update - 4 */}
    </span>
  )}
</div>
      

      {/* Post Title */}
      <h3 className="forum-post__title">
        {post.title}
      </h3>

      {/* Post Footer with Author and Stats */}
      <div className="forum-post__footer">
        <div className="forum-post__author">
          <div className="forum-post__avatar" aria-hidden="true">
            {initials}
          </div>
          <div className="forum-post__author-info">
            <span className="forum-post__author-name">{post.author}</span>
            <span className="forum-post__timestamp">{post.timeAgo}</span>
          </div>
        </div>

        <div className="forum-post__stats" aria-label={`${post.replyCount} replies`}>
          <MessageSquare size={16} aria-hidden="true" />
          <span className="forum-post__reply-count">
            {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'}
          </span>
        </div>
      </div>
    </article>
  );
};

export default ForumPost;