/**
 * @file MentionBadge.tsx
 * @description
 * This component displays a small badge with a count of comments on a slide thumbnail.
 * Responsibilities:
 *   - Show the numeric count; hide when count === 0.
 *   - Expose an onClick that opens the full ForumModal scoped to slideId.
 *   - Provide a hover tooltip “View discussion”.
 *   - Log render ([MBAD0001]) and click ([MBAD0002]) events for observability.
 *   - Accept props { count: number; onClick: () => void }.
 *   - Maintain pre-existing CSS styling; no canvas.
 * 
 *  Accessibility:
 *   - role="button", aria-label={`View discussion, ${count} comments`}
 */

import React from 'react';

interface MentionBadgeProps {
  count: number;
  onClick: () => void;
}

const MentionBadge: React.FC<MentionBadgeProps> = ({ count, onClick }) => {
  console.log('MentionBadge.tsx [MBAD0001] › rendering count=', count);
  if (count <= 0) return null;

  const handleClick = () => {
    console.log('MentionBadge.tsx [MBAD0002] › clicked, opening forum');
    onClick();
  };

  return (
    <span
      className="badge-mention"
      role="button"
      aria-label={`View discussion, ${count} comments`}
      title="View discussion"
      onClick={handleClick}
    >
      {count}
    </span>
  );
};

export default MentionBadge;
