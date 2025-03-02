/**
 * AskTab.tsx
 *
 * This module provides both the presentational UI for the Ask tab
 * as well as the submission logic for Q&A requests. The submission logic
 * has been refactored so that it does not call React hooks internally.
 * Instead, the required context values (activeConceptMapId, getModuleSummary, docFileID)
 * are passed in as parameters.
 */

import React from 'react';
import markdownIt from 'markdown-it';
import { askQuestionAPI } from '@/app/Library/utils/aiServiceApi';
import SafeContent from '@/app/studygraph/(studygraph)/components/utils/SafeContent';
import { ChatMessage } from './ChatTab';

// Instantiate a markdown-it parser.
const mdParser = new markdownIt();

export interface AskTabUIProps {
  messages: ChatMessage[];
}

// Presentational UI component for displaying Ask tab messages.
const AskTabUI: React.FC<AskTabUIProps> = ({ messages }) => {
  return (
    <>
      {messages.map((msg) => {
        if (msg.type === 'assistant') {
          return (
            <div key={msg.id} className="select-text">
              <div className="bg-white border border-gray-200 rounded-lg p-3 w-full shadow-sm select-text">
                <SafeContent
                  html={msg.content}
                  className="text-sm prose max-w-none text-gray-800 select-text"
                />
              </div>
            </div>
          );
        } else if (msg.type === 'user') {
          return (
            <div key={msg.id} className="flex justify-end gap-2 select-text">
              <div className="bg-[#ebf5ff] text-gray-900 border border-[#c3ddfd] rounded-lg p-3 max-w-[80%] select-text">
                <p className="text-sm text-[#1a56db] select-text">{msg.content}</p>
              </div>
            </div>
          );
        } else {
          return (
            <div key={msg.id} className="flex gap-2 select-text">
              <div className="text-sm text-gray-500">{msg.content}</div>
            </div>
          );
        }
      })}
    </>
  );
};

export interface AskSubmitParams {
  input: string;
  askMessages: ChatMessage[];
  setAskMessages: (msgs: ChatMessage[]) => void;
  setInput: (val: string) => void;
  // The following parameters are passed from the parent component (ChatTab)
  activeConceptMapId: string;
  getModuleSummary: (moduleId: string) => { hasSummary: boolean; summary: string | null };
  docFileID: string;
}

// Refactored handleAskSubmit that no longer calls hooks internally.
export async function handleAskSubmit({
  input,
  askMessages,
  setAskMessages,
  setInput,
  activeConceptMapId,
  getModuleSummary,
  docFileID,
}: AskSubmitParams) {
  const trimmed = input.trim();
  if (!trimmed) return;

  // Immediately clear the input field.
  setInput('');

  // Add the user's message.
  const userMessage: ChatMessage = {
    id: Date.now(),
    type: 'user',
    content: trimmed,
  };
  const updatedMessages = [...askMessages, userMessage];

  // Use the passed context values.
  const { hasSummary, summary } = getModuleSummary(activeConceptMapId);
  if (!docFileID) {
    const errorMsg: ChatMessage = {
      id: Date.now() + 1,
      type: 'assistant',
      content: "Error: Document ID not available.",
    };
    setAskMessages([...updatedMessages, errorMsg]);
    return;
  }

  try {
    const response = await askQuestionAPI(
      trimmed,
      activeConceptMapId,
      summary,
      hasSummary,
      docFileID
    );

    const rawMarkdown = response.question_response || "No response received.";
    const htmlFromMarkdown = mdParser.render(rawMarkdown);

    const answerMessage: ChatMessage = {
      id: Date.now() + 2,
      type: 'assistant',
      content: htmlFromMarkdown,
    };

    setAskMessages([...updatedMessages, answerMessage]);
  } catch (error) {
    console.error("[AskTab] Error in askQuestionAPI:", error);
    const failMessage: ChatMessage = {
      id: Date.now() + 3,
      type: 'assistant',
      content: "Failed to get an answer. Please try again later.",
    };
    setAskMessages([...updatedMessages, failMessage]);
  }
}

const AskTab = {
  UI: AskTabUI,
  handleAskSubmit,
};

export default AskTab;
