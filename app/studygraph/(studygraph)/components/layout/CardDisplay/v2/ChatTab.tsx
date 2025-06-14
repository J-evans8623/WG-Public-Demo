// ChatTab.tsx
// /app/Library/Components/ChatTab.tsx

import React, { useState, useCallback, useEffect } from 'react';
import AskTab from '../chatTab/AskTab';
import { useSelectionAttachment } from '@/app/Library/Context/SelectionAttachmentContext';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useChatHistory, ChatMessage } from '@/app/Library/Context/ChatHistoryContext';
import './ChatTab.css'; // our new CSS for chat bubbles, input, attachment

/**
 * ChatTab
 *
 * Renders the chat pane:
 *   • Left: scrollable chat history with styled bubbles.
 *   • Bottom: input + “Ask” button + attachment preview.
 *
 * All existing functionality (API calls, Firestore persistence, attachments) remains unchanged.
 * We simply replaced Tailwind classes with our own for the new aesthetic.
 */
const ChatTab: React.FC = () => {
  // 1) Local UI state
  const [input, setInput] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<string | null>(null);

  // 2) Context hooks
  const { attachedText, isAskOpen, clearAttachment } = useSelectionAttachment();
  const { docFileID, saveToFirebase } = useYDoc();
  const { messages, addMessage, chatDirty, resetDirty } = useChatHistory();

  // 3) Capture a new attachment (text selection bubble)
  useEffect(() => {
    if (isAskOpen && attachedText) {
      setPendingAttachment(attachedText);
      clearAttachment();
    }
  }, [isAskOpen, attachedText, clearAttachment]);

  // 4) Cancel the pending attachment
  const handleCancelAttachment = () => {
    setPendingAttachment(null);
  };

  // 5) Submit a question + optional attachment
  const handleSubmit = useCallback(async () => {
    const question = input.trim();
    if (!question) return;

    // 5.1) If there’s a pending attachment, send that first
    if (pendingAttachment) {
      const attachmentMsg: ChatMessage = {
        id: Date.now(),
        type: 'attachment',
        content: pendingAttachment,
      };
      addMessage(attachmentMsg);
    }

    // 5.2) Reset local UI
    setPendingAttachment(null);
    setInput('');

    // 5.3) Fire off the API call; it will append user + assistant messages
    await AskTab.handleAskSubmit({
      input: question,
      textSelection: pendingAttachment ?? '',
      docFileID: docFileID || '',
      addMessage,
    });
    // Persistence is handled in the effect below.
  }, [input, pendingAttachment, docFileID, addMessage]);

  // 6) Persist chat whenever it becomes dirty
  useEffect(() => {
    if (!chatDirty) return;

    (async () => {
      try {
        await saveToFirebase(messages);
      } catch (error) {
        console.error('[ChatTab] saveToFirebase failed:', error);
      } finally {
        resetDirty();
      }
    })();
  }, [chatDirty, messages, saveToFirebase, resetDirty]);

  return (
    <div className="chat-panel">
      {/* Chat history (scrollable) */}
      <div className="chat-content">
        <AskTab.UI messages={messages} />
      </div>

      {/* Input + optional attachment */}
      <div className="chat-input-container">
        {pendingAttachment && (
          <div className="attachmentWrapper">
            <p className="attachmentPreview">{pendingAttachment}</p>
            <button
              className="attachmentCancel"
              onClick={handleCancelAttachment}
              aria-label="Cancel attachment"
            >
              ×
            </button>
          </div>
        )}

        <div className={`input-row ${pendingAttachment ? 'with-attachment' : ''}`}>
          <textarea
            className="chat-input"
            placeholder="Ask a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            rows={1}
          />
          <button className="send-btn" onClick={handleSubmit}>
            Ask
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatTab;
