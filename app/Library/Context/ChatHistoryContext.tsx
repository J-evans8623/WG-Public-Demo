import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/**
 * @file ChatHistoryContext.tsx
 * @description
 *   Holds the persistent chat history (including attachments) and a “dirty” flag
 *   indicating whether the history has changed since the last save.
 *
 * Responsibilities:
 *   - Provide chat messages.
 *   - Expose functions to add/replace/clear messages, marking history as dirty.
 *   - Expose `chatDirty` flag and `resetDirty` to clear it after saving.
 */

export interface ChatMessage {
  id: number;
  type: 'assistant' | 'user' | 'system' | 'attachment';
  content: string;
}

interface ChatHistoryContextValue {
  /** Full chat history array */
  messages: ChatMessage[];
  /** Append a message (marks dirty) */
  addMessage: (msg: ChatMessage) => void;
  /** Replace the entire array (marks dirty) */
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  /** Clear all messages (marks dirty) */
  clearMessages: () => void;
  /** Whether chat has changed since last save */
  chatDirty: boolean;
  /** Reset dirty flag after a successful save */
  resetDirty: () => void;
}

const ChatHistoryContext = createContext<ChatHistoryContextValue | undefined>(undefined);

export const ChatHistoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [messages, setRawMessages] = useState<ChatMessage[]>([
    {
      id: Date.now(),
      type: 'assistant',
      content: "Have a question? Ask anything, and I'll provide an explanation.",
    },
  ]);
  const [chatDirty, setChatDirty] = useState<boolean>(false);

  // Wrap setRawMessages to mark dirty
  const setMessages: ChatHistoryContextValue['setMessages'] = useCallback(
    updater => {
      setRawMessages(updater);
    },
    []
  );

  const addMessage = useCallback<ChatHistoryContextValue['addMessage']>(msg => {
    setRawMessages(prev => [...prev, msg]);
    setChatDirty(true);
  }, []);

  const clearMessages = useCallback<ChatHistoryContextValue['clearMessages']>(() => {
    setRawMessages([]);
  }, []);

  const resetDirty = useCallback<ChatHistoryContextValue['resetDirty']>(() => {
    setChatDirty(false);
  }, []);

  return (
    <ChatHistoryContext.Provider
      value={{ messages, addMessage, setMessages, clearMessages, chatDirty, resetDirty }}
    >
      {children}
    </ChatHistoryContext.Provider>
  );
};

export function useChatHistory(): ChatHistoryContextValue {
  const ctx = useContext(ChatHistoryContext);
  if (!ctx) throw new Error('useChatHistory must be used within a ChatHistoryProvider');
  return ctx;
}
