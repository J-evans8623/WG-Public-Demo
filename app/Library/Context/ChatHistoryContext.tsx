// ChatHistoryContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react'; // update - 19
import { useYDoc, ChatReadyPayload } from '@/app/Library/Context/YDocContext'; // update - 20

/**
 * @file ChatHistoryContext.tsx
 * @description
 *   The ChatHistory context is the single source of truth for the user-assistant conversation
 *   attached to the currently opened notebook. This provider owns the message list and the
 *   “dirty” flag that indicates whether chat should be saved on the next autosave tick. In this
 *   revision, the context also subscribes to the YDoc layer’s authoritative readiness signal
 *   (`CHAT_READY`) to initialize or replace the chat history after a document load or new document
 *   creation. The event payload includes `{ docId, messages, fresh }`, where `fresh` means the
 *   notebook had no chat file on storage. On receipt, the context sets messages **without**
 *   marking the conversation dirty, ensuring autosave only persists user-initiated changes. The
 *   provider guards against cross-document races by verifying the event’s `docId` equals the live
 *   `docFileID` at the time of handling. Logging is limited to high-signal checkpoints to support
 *   production observability while avoiding noise.
 *
 * Responsibilities:
 *   - Hold and expose the chat messages array.
 *   - Expose append/replace/clear utilities; only user-affecting paths mark chat as dirty.
 *   - Maintain and expose `chatDirty` plus a `resetDirty` helper for autosave flows.
 *   - Subscribe to YDoc `CHAT_READY` and initialize chat state without setting dirty.
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
  /**
   * Replace the entire array (does NOT mark dirty).
   * This is intentionally non-dirty so initialization does not trigger autosave.
   */ // update - 21
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  /** Clear all messages (does NOT mark dirty) */ // update - 22
  clearMessages: () => void;
  /** Whether chat has changed since last save */
  chatDirty: boolean;
  /** Reset dirty flag after a successful save */
  resetDirty: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const ChatHistoryContext = createContext<ChatHistoryContextValue | undefined>(undefined);

export const ChatHistoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const DEFAULT_GREETING = "Have a question? Ask anything, and I'll provide an explanation."; // update - 23

  // Local chat state
  const [messages, setRawMessages] = useState<ChatMessage[]>([
    {
      id: Date.now(),
      type: 'assistant',
      content: DEFAULT_GREETING,
    },
  ]);
  const [chatDirty, setChatDirty] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // ---- YDoc wiring (Phase 2): subscribe to CHAT_READY ----
  const { docFileID, addChatReadyListener, removeChatReadyListener } = useYDoc(); // update - 24

  // Buffer to hold a pending CHAT_READY payload until docFileID is available/matching // update - 25
  const pendingInitRef = useRef<ChatReadyPayload | null>(null); // update - 26

  /**
   * installMessagesFromPayload
   * Installs chat messages from a CHAT_READY payload without marking the chat as dirty.
   * It applies the “fresh greeting” policy (inject greeting only when fresh and no prior
   * messages exist on storage). Complexity is O(N) where N is the number of messages,
   * which is optimal for a full replacement. This helper centralizes the logic so both
   * the live event handler and the deferred application path can reuse it uniformly.
   */ // update - 27
  const installMessagesFromPayload = useCallback((payload: ChatReadyPayload) => {
    const nextMessages: ChatMessage[] =
      Array.isArray(payload.messages) && payload.messages.length > 0
        ? payload.messages
        : payload.fresh
          ? [{ id: Date.now(), type: 'assistant', content: DEFAULT_GREETING }]
          : [];

    setRawMessages(nextMessages);
    setChatDirty(false);
    // console.log('ChatHistoryContext.tsx 4311 › Installed messages from payload', { count: nextMessages.length }); // update - 28
  }, []); // update - 29

  /**
   * handleChatReadyEvent
   * Initializes or replaces chat when YDoc signals a notebook is ready. It ensures:
   * (1) The event belongs to the currently selected notebook (`payload.docId === docFileID`);
   * (2) Initialization does not mark the chat as dirty, so autosave won’t upload on load;
   * (3) A greeting is injected only when the notebook is fresh (no chat on storage).
   * This function performs O(N) work where N is the number of messages installed.
   */ // update - 30
  const handleChatReadyEvent = useCallback((payload: ChatReadyPayload) => {
    // console.log('ChatHistoryContext.tsx 4301 › CHAT_READY received', { incomingDoc: payload.docId, currentDoc: docFileID, count: payload.messages?.length ?? 0, fresh: payload.fresh }); // update - 31

    // Step 0: If docFileID is not yet known, buffer and return. // update - 32
    if (!docFileID) {
      pendingInitRef.current = payload;
      // console.log('ChatHistoryContext.tsx 4312 › Buffered CHAT_READY (docFileID not yet available)'); // update - 33
      return;
    }

    // Step 1: Ignore or buffer events for other docs; apply later if this doc becomes current. // update - 34
    if (payload.docId !== docFileID) {
      pendingInitRef.current = payload;
      // console.log('ChatHistoryContext.tsx 4313 › Buffered CHAT_READY (mismatched doc). Will re-check on doc switch.'); // update - 35
      return;
    }

    // Step 2: Valid for current doc → install immediately. // update - 36
    installMessagesFromPayload(payload); // update - 37
  }, [docFileID, installMessagesFromPayload]); // update - 38

  // If we have a buffered payload, apply it once docFileID becomes available and matches. // update - 39
  useEffect(() => {
    if (!docFileID || !pendingInitRef.current) return;
    if (pendingInitRef.current.docId !== docFileID) return;

    // console.log('ChatHistoryContext.tsx 4314 › Applying buffered CHAT_READY after docFileID became available', { docFileID }); // update - 40
    installMessagesFromPayload(pendingInitRef.current);
    pendingInitRef.current = null;
  }, [docFileID, installMessagesFromPayload]); // update - 41

  // Subscription lifecycle: mount → add listener, unmount → remove listener
  useEffect(() => {
    // Step 1: Register
    addChatReadyListener(handleChatReadyEvent);
    // console.log('ChatHistoryContext.tsx 4304 › Registered CHAT_READY listener'); // update - 42

    // Step 2: Cleanup
    return () => {
      removeChatReadyListener(handleChatReadyEvent);
      // console.log('ChatHistoryContext.tsx 4305 › Unregistered CHAT_READY listener'); // update - 43
    };
  }, [addChatReadyListener, removeChatReadyListener, handleChatReadyEvent]); // update - 44

  // ---- Public API (user-driven changes mark dirty) ----

  // Wrap setRawMessages (intentionally does NOT mark dirty)
  const setMessages: ChatHistoryContextValue['setMessages'] = useCallback(
    updater => {
      setRawMessages(updater);
    },
    []
  ); // update - 45

  const addMessage = useCallback<ChatHistoryContextValue['addMessage']>(msg => {
    // Step 1: append
    setRawMessages(prev => [...prev, msg]);
    // Step 2: mark dirty for autosave to pick up
    setChatDirty(true);
  }, []); // update - 46

  const clearMessages = useCallback<ChatHistoryContextValue['clearMessages']>(() => {
    setRawMessages([]);
    // Note: clearing is often used during UI transitions; do not mark dirty here. // update - 47
  }, []);

  const resetDirty = useCallback<ChatHistoryContextValue['resetDirty']>(() => {
    setChatDirty(false);
  }, []); // update - 48

  return (
    <ChatHistoryContext.Provider
      value={{ messages, addMessage, setMessages, clearMessages, chatDirty, resetDirty ,   isLoading,
      setIsLoading }}
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
