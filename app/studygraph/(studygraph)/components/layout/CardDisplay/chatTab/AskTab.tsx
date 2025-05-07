import React from 'react';
import markdownIt from 'markdown-it';
import { askQuestionAPI } from '@/app/Library/utils/aiServiceApi';
import SafeContent from '@/app/studygraph/(studygraph)/components/utils/SafeContent';
import { Paperclip } from 'lucide-react';
import type { ChatMessage } from '@/app/Library/Context/ChatHistoryContext';

const mdParser = new markdownIt();

/**
 * @file AskTab.tsx
 * @description
 *   Presentation + submission logic for the Ask tab, now wired to accept
 *   a messaging callback instead of calling hooks internally.
 *
 * Responsibilities:
 *   - Renders messages of all types (assistant, user, system, attachment).
 *   - On submit, immediately adds the user’s message then appends the model’s response.
 *   - Forwards `textSelection` along with the question.
 */

export interface AskTabUIProps {
  messages: ChatMessage[];
}

export const AskTabUI: React.FC<AskTabUIProps> = ({ messages }) => (
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
  </>
);

export interface AskSubmitParams {
  input: string;
  textSelection: string;
  docFileID: string;
  /** Callback injected from ChatTab */
  addMessage: (msg: ChatMessage) => void;
}

/**
 * @description
 *   Sends question + PDF selection to the backend.
 *   Immediately shows user message & model reply via the injected callback.
 */
export async function handleAskSubmit({
  input,
  textSelection,
  docFileID,
  addMessage,
}: AskSubmitParams) {
  const question = input.trim();
  if (!question) return;

  // 1) Show user message
  addMessage({ id: Date.now(), type: 'user', content: question });

  // 2) Validate
  if (!docFileID) {
    addMessage({
      id: Date.now() + 1,
      type: 'assistant',
      content: 'Error: Document ID not available.',
    });
    return;
  }

  try {
    // 3) API call
    const response = await askQuestionAPI(question, textSelection, docFileID);
    const raw = response.question_response ?? 'No response received.';
    const html = mdParser.render(raw);

    // 4) Show assistant reply
    addMessage({ id: Date.now() + 2, type: 'assistant', content: html });
  } catch (err) {
    console.error('[AskTab] askQuestionAPI error', err);
    addMessage({
      id: Date.now() + 3,
      type: 'assistant',
      content: 'Failed to get an answer. Please try again later.',
    });
  }
}

const AskTab = { UI: AskTabUI, handleAskSubmit };
export default AskTab;
