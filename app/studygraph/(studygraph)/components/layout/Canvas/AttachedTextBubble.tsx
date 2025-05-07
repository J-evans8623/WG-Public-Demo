// app/Library/Components/AttachedTextBubble.tsx

import React from 'react';
import '../CardDisplay/chatTab/ChatTab.css';

interface AttachedTextBubbleProps {
  /** Text snippet pasted from the PDF */
  text: string;
  /** Called when the user dismisses the bubble */
  onCancel: () => void;
}

/**
 * AttachedTextBubble
 *
 * Displays a preview of the text that will be sent as part
 * of the next AI request, with an '×' to clear it.
 */
const AttachedTextBubble: React.FC<AttachedTextBubbleProps> = ({ text, onCancel }) => {
  return (
    <div className="attachmentWrapper">
      <p className="attachmentPreview">{text}</p>
      <button
        type="button"
        className="attachmentCancel"
        aria-label="Cancel attachment"
        onClick={onCancel}
      >
        ×
      </button>
    </div>
  );
};

export default AttachedTextBubble;
