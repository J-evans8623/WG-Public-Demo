/**
 * @file DiscussButton.tsx
 * @description
 * This component renders a “Discuss” button that lives in the slide toolbar. It is responsible for:
 *   - Displaying a localized "Discuss" label or icon.
 *   - Exposing an onClick handler that opens the CommentInputModal for the given slideId.
 *   - Emitting critical console logs for observability:
 *       • File/line marker [DBTN0001] when rendered.
 *       • [DBTN0002] when clicked, reporting the slideId.
 *   - Accepting `slideId: string` via props to scope the comment flow.
 * 
 * Responsibilities:
 *   - UI atom: launch new comment composer for a slide.
 *   - Accessibility: include aria-label="Add comment to slide".
 *   - Logging: identify render and click with unique 4-digit codes.
 */

import React from 'react';

interface DiscussButtonProps {
  slideId: string;
  onOpen: (slideId: string) => void;
}

const DiscussButton: React.FC<DiscussButtonProps> = ({ slideId, onOpen }) => {
  console.log('DiscussButton.tsx [DBTN0001] › rendering for slide', slideId);
  const handleClick = () => {
    console.log('DiscussButton.tsx [DBTN0002] › clicked for slide', slideId);
    onOpen(slideId);
  };

  return (
    <button
      className="btn-discuss"
      aria-label="Add comment to slide"
      onClick={handleClick}
    >
      Discuss
    </button>
  );
};

export default DiscussButton;
