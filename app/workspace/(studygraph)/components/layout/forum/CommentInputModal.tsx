/**
 * @file CommentInputModal.tsx
 * @description
 * Provides a slide-scoped comment composer modal:
 *   - Renders a focus-trapped <textarea> and “Post” button.
 *   - Autofocuses the textarea on mount.
 *   - Supports ⌘+Enter to submit.
 *   - Calls onPost(slideId, text) then onClose().
 *   - Logs mount ([CIMD0001]), submit ([CIMD0002]), and cancel ([CIMD0003]).
 *   - Props: { slideId: string; onPost: (slideId, text) => void; onClose: () => void }.
 *   - Accessibility: role="dialog", aria-modal="true", aria-label="New comment".
 */

import React, { useEffect, useRef, useState } from 'react';

interface CommentInputModalProps {
  slideId: string;
  onPost: (slideId: string, heading:string, body: string) => void;
  onClose: () => void;
}

const CommentInputModal: React.FC<CommentInputModalProps> = ({ slideId, onPost, onClose }) => {
  const [heading, setHeading] = useState('');
  const [body, setBody] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    console.log('CommentInputModal.tsx [CIMD0001] › mounted for slide', slideId);
    textareaRef.current?.focus();
  }, [slideId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      console.log('CommentInputModal.tsx [CIMD0003] › canceled via Escape');
      onClose();
    }
  };

  const submit = () => {
    console.log('CommentInputModal.tsx [CIMD0002] › post:', body);
    onPost(slideId,heading, body.trim());
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div
        className="modal-small"
        role="dialog"
        aria-modal="true"
        aria-label="New comment"
      >
        <textarea
          ref={textareaRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your comment…"
        />
        <div className="modal-actions">
          <button onClick={submit} disabled={!body.trim()}>
            Post
          </button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default CommentInputModal;
