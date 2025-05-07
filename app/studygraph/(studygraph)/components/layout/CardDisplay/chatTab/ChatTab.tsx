// /app/Library/Components/ChatTab.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AskTab from './AskTab';
import { useSelectionAttachment } from '@/app/Library/Context/SelectionAttachmentContext';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useChatHistory, ChatMessage } from '@/app/Library/Context/ChatHistoryContext';
import './ChatTab.css';

/**
 * ChatTab
 *
 * Renders the chat pane, handles user input plus attachments,
 * delegates to the LLM API, and persists chat → Firestore.
 */
const ChatTab: React.FC = () => {
  // 1) Local UI state
  const [input, setInput] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<string | null>(null);

  // 2) Context hooks
  const { attachedText, isAskOpen, clearAttachment } = useSelectionAttachment();
  const { docFileID, saveToFirebase } = useYDoc();
  const {
    messages,
    addMessage,
    chatDirty,
    resetDirty,
  } = useChatHistory();

  // 3) Capture a new attachment bubble
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

    // 5.1) Stash the attachment first
    if (pendingAttachment) {
      const attachmentMsg: ChatMessage = {
        id: Date.now(),
        type: 'attachment',
        content: pendingAttachment,
      };
      addMessage(attachmentMsg);
    }

    // 5.2) Reset local UI (no spinner)
    setPendingAttachment(null);
    setInput('');

    // 5.3) Fire off the API call; it will append user + assistant messages
    await AskTab.handleAskSubmit({
      input: question,
      textSelection: pendingAttachment ?? '',
      docFileID: docFileID || '',
      addMessage,
    });
    // ↳ Persistence now handled in the effect below
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
    <div className="h-full flex flex-col select-text">
      {/* Chat history */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AskTab.UI messages={messages} />
      </div>

      {/* Input + attachment */}
      <div className="p-4 border-t bg-white">
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

        <div className={`relative flex items-center gap-2 ${pendingAttachment ? 'mt-2' : ''}`}>
          <Input
            placeholder="Ask a question..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <Button
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Ask
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatTab;
