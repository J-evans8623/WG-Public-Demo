/**
 * @file AskTab.tsx (Enhanced with Centralized API Integration)
 * @description
 * Enhanced chat interface component that integrates with the centralized API service system
 * for consistent subscription management and error handling. This updated implementation
 * replaces direct legacy API calls with the centralized EnhancedApiService while maintaining
 * the existing visual design and chat interaction patterns. The component provides seamless
 * integration with the event-driven error handling system that automatically triggers
 * subscription upgrade modals for freemium users and rate limit modals for premium users
 * without disrupting the core chat experience. All API interactions are processed through
 * the unified service with comprehensive error handling and user feedback mechanisms that
 * ensure consistent behavior across all AI services while preserving the specialized chat
 * interface functionality and markdown rendering capabilities for optimal user experience.
 * 
 * Responsibilities:
 * - Provide chat interface for AI assistant interactions with enhanced API integration
 * - Integrate with enhanced API service for consistent subscription management and error handling
 * - Maintain existing visual design, chat flow, and markdown rendering functionality
 * - Handle subscription validation through backend-driven error handling and modal triggering
 * - Process chat messages and responses through existing message management systems
 * - Support comprehensive logging for debugging and user interaction tracking
 * - Ensure seamless integration with centralized modal management for error scenarios
 */

import React from 'react';
import markdownIt from 'markdown-it';
import { apiService } from '@/app/src/services/ApiService';
import SafeContent from '@/app/workspace/(studygraph)/components/utils/SafeContent';
import { Paperclip } from 'lucide-react';
import type { ChatMessage } from '@/app/Library/Context/ChatHistoryContext';

const mdParser = new markdownIt();

/**
 * AskTabUIProps
 * @description Props interface for the AskTabUI component
 */
export interface AskTabUIProps {
  messages: ChatMessage[];
   isLoading: boolean;
}

/**
 * AskTabUI
 * @description
 * Chat interface UI component that renders different message types including assistant responses,
 * user queries, system messages, and PDF attachments while maintaining existing visual design
 * and accessibility patterns for optimal user experience and message comprehension.
 * @param messages Array of chat messages to render in the interface
 * @returns Enhanced chat UI component with consistent message rendering
 */
export const AskTabUI: React.FC<AskTabUIProps> = ({ messages,  isLoading }) => (
  <>
    {messages.map(msg => {
      // 1) PDF attachment bubble
      if (msg.type === 'attachment') {
        return (
          <div key={msg.id} className="attachmentWrapper" title={msg.content}>
            <Paperclip className="attachmentIcon" aria-hidden="true" />
            <p className="attachmentPreview">{msg.content}</p>
          </div>
        );
      }

      // 2) Assistant response
      if (msg.type === 'assistant') {
        return (
          <div key={msg.id} className="select-text">
            <div className="bg-white border border-gray-200 rounded-lg p-3 w-full shadow-sm">
              <SafeContent html={msg.content} className="text-sm prose max-w-none text-gray-800" />
            </div>
          </div>
        );
      }

      // 3) User query
      if (msg.type === 'user') {
        return (
          <div key={msg.id} className="flex justify-end gap-2 select-text">
            <div className="bg-[#ebf5ff] text-gray-900 border border-[#c3ddfd] rounded-lg p-3 max-w-[80%]">
              <p className="text-sm text-[#1a56db]">{msg.content}</p>
            </div>
          </div>
        );
      }

      // 4) System fallback
      return (
        <div key={msg.id} className="flex gap-2 select-text">
          <div className="text-sm text-gray-500">{msg.content}</div>
        </div>
      );
    })}
    {/* NEW: Loading indicator with breathing animation */}
    {isLoading && (
      <div className="select-text">
        <div className="bg-white border border-gray-200 rounded-lg p-3 w-full shadow-sm">
          <div className="chat-loading-breathe">
            Thinking...
          </div>
        </div>
      </div>
    )}
  </>
);

/**
 * AskSubmitParams
 * @description Interface for ask submission parameters
 */
export interface AskSubmitParams {
  input: string;
  textSelection: string;
  docFileID: string;
  /** Callback injected from ChatTab */
  addMessage: (msg: ChatMessage) => void;
  setIsLoading: (loading: boolean) => void; 
}

/**
 * handleAskSubmit
 * @description
 * Enhanced question submission handler that integrates with the centralized API service
 * for consistent subscription management and error handling. This function replaces legacy
 * API calls with the unified service that automatically handles subscription validation,
 * rate limiting, and error modal triggering while maintaining existing chat message flow
 * and markdown processing. The implementation ensures seamless user experience with
 * automatic error handling through the event-driven architecture.
 * @param input User's question input for AI processing
 * @param textSelection Selected text from PDF for context
 * @param docFileID Document identifier for context processing
 * @param addMessage Callback function for adding messages to chat interface
 * @returns Promise resolving when question processing is complete or error handling triggered
 */
export async function handleAskSubmit({
  input,
  textSelection,
  docFileID,
  addMessage,
  setIsLoading,
}: AskSubmitParams) {
  const question = input.trim();
  if (!question) return;

  console.log('[AskTab.tsx][4019] Question submission initiated in chat interface', {
    hasQuestion: !!question,
    hasSelection: !!textSelection,
    docFileID
  });

  // Step 1: Show user message immediately
  addMessage({ id: Date.now(), type: 'user', content: question });

  // Step 2: Validate document context
  if (!docFileID) {
    addMessage({
      id: Date.now() + 1,
      type: 'assistant',
      content: 'Error: Document ID not available.',
    });
    return;
  }

  try {
    // loading animation 
    setIsLoading(true);
    // Step 3: Call enhanced API service instead of legacy askQuestionAPI
    const response = await apiService.askAssistant(question, textSelection, docFileID);
    setIsLoading(false);
    // Step 4: Process successful response
    if (response.success && response.data) {
      const raw = response.data.question_response ?? 'No response received.';
      const html = mdParser.render(raw);

      console.log('[AskTab.tsx][4020] Question response processed successfully in chat', {
        hasResponse: !!raw
      });

      // Step 5: Show assistant reply
      addMessage({ id: Date.now() + 2, type: 'assistant', content: html });
    } else {
      // Step 6: Error handling is managed by the enhanced API service event system
      console.log('[AskTab.tsx][4021] Question failed in chat, error handled by event system', {
        success: response.success,
        errorType: response.error?.type
      });

      // Step 7: Show generic error message in chat
      addMessage({
        id: Date.now() + 3,
        type: 'assistant',
        content: 'Failed to get an answer. Please try again later.',
      });
    }
  } catch (err) {
    setIsLoading(false);
    // Step 8: Catch-all error handling for unexpected failures
    console.error('[AskTab.tsx][4022] Unexpected error in chat question submission:', err);
    addMessage({
      id: Date.now() + 4,
      type: 'assistant',
      content: 'Failed to get an answer. Please try again later.',
    });
  }
}

const AskTab = { UI: AskTabUI, handleAskSubmit };
export default AskTab;