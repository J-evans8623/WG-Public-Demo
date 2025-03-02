/**
 * ExploreTab.tsx
 *
 * This module provides the UI and submission logic for the Topic Generation pipeline.
 * When a user submits a topic request from the Explore tab, the component:
 *   - Retrieves the currently selected node's export study data using the exportStudyData hook.
 *   - Issues a request to aiServiceApi.generateTopic with the user's topic request,
 *     export data, module ID, summary, summaryPresent flag, and file ID.
 *   - Processes the returned AI response by calling parseTopicResponse to update the concept map.
 *   - The merge option (controlled via a checkbox) determines whether the generated content
 *     should merge into the target node (default) or be attached as a new child.
 *
 * Responsibilities:
 *   - Displays messages (assistant, user, conceptNode) in the chat UI with consistent styling.
 *   - Provides a 'merge content into selected topic' checkbox to switch between merging or attaching.
 *   - Calls handleExploreSubmit on user submission.
 *
 * Dependencies:
 *   - generateTopic from aiServiceApi for sending topic generation requests.
 *   - parseTopicResponse from topicResponseParser for processing the AI response.
 *   - useExportStudyData hook to export study data from the selected node.
 *   - Context hooks: useNodeSelection, useNodesContext, useLessonModule, useYDoc.
 */

import React from 'react';
import { Link2 } from 'lucide-react';
import SafeContent from '@/app/studygraph/(studygraph)/components/utils/SafeContent';
import { ChatMessage } from './ChatTab';
import { generateTopic } from '@/app/Library/utils/aiServiceApi';
import { parseTopicResponse } from '@/app/studygraph/(studygraph)/components/hooks/topicResponseParser';

/**
 * ExploreTabUIProps
 * 
 * - messages: The array of chat messages for the Explore tab
 * - selectedTopic: The name of the selected node/topic in the concept map
 */
interface ExploreTabUIProps {
  messages: ChatMessage[];
  selectedTopic: string;
}

/**
 * ConceptNodeOutput
 *
 * Displays a newly created concept node message in a styled card with a "View" button.
 */
const ConceptNodeOutput: React.FC<{ message: ChatMessage }> = ({ message }) => {
  return (
    <div className="flex flex-col w-full max-w-2xl p-4 bg-white rounded-lg shadow">
      <div className="mb-3 text-gray-700">
        {message.content}
      </div>
      <div className="p-3 mb-2 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-blue-500"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div className="flex-grow">
            <div className="font-medium text-blue-600">New Concept Node</div>
            <div className="text-xs text-gray-500">
              Added to: {message.link || 'Concept Map'}
            </div>
          </div>
          <button className="px-3 py-1 bg-blue-500 text-white text-sm font-medium rounded hover:bg-blue-600">
            View
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * ExploreTabUI
 *
 * Renders the messages for the Explore (Topic Generation) tab with consistent styling,
 * including an assistant introduction, user messages, concept node messages, etc.
 */
const ExploreTabUI: React.FC<ExploreTabUIProps> = ({ messages, selectedTopic }) => {
  if (!messages || messages.length === 0) return null;

  return (
    <>
      {/* The first message is typically an assistant introduction */}
      {messages[0].type === 'assistant' && (
        <div key={messages[0].id} className="select-text">
          {selectedTopic && (
            <div className="flex items-center mb-2">
              <Link2 className="w-4 h-4 text-blue-500 mr-1" />
              <span className="text-blue-600 text-sm">Selected topic: {selectedTopic}</span>
            </div>
          )}
          <div className="bg-white border border-gray-200 rounded-lg p-3 w-full shadow-sm select-text">
            <SafeContent
              html={messages[0].content}
              className="text-sm prose max-w-none text-gray-800 select-text"
            />
            {/* This checkbox must be shown at all times, regardless of selectedTopic */}
            <div className="flex items-center space-x-2 mt-2">
              <input
                id="merge-checkbox-initial"
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:ring-blue-500"
              />
              <label
                htmlFor="merge-checkbox-initial"
                className="text-sm text-gray-700 flex items-center cursor-help"
                title="This option will add content to the selected topic"
              >
                Merge content into selected topic
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Subsequent messages */}
      {messages.slice(1).map((msg) => {
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
        } else if (msg.type === 'conceptNode') {
          return <ConceptNodeOutput key={msg.id} message={msg} />;
        } else {
          // Fallback for any other message types
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

/**
 * ExploreSubmitParams
 *
 * Defines the parameters needed by handleExploreSubmit, including the user input,
 * current list of messages, state setters, the selected topic string, a merge flag,
 * the exportStudyData function, the focus node ID, the active concept map ID, a function
 * to retrieve module summary info, and the docFileID, plus all dependencies for parseTopicResponse.
 */
interface ExploreSubmitParams {
  input: string;
  exploreMessages: ChatMessage[];
  setExploreMessages: (msgs: ChatMessage[]) => void;
  setInput: (val: string) => void;
  selectedTopic: string;
  merge: boolean;
  exportStudyData: (nodeIds: string[]) => string;
  focusNodeId: string | null;
  activeConceptMapId: string;
  getModuleSummary: (moduleId: string) => { hasSummary: boolean; summary: string | null };
  docFileID: string;

  // Dependencies from context for parseTopicResponse:
  updateNodeTitle: (nodeId: string, newTitle: string, mapID?: string) => void;
  setNodes: (nodes: Map<string, any>, mapID?: string) => void;
  nodes: Map<string, any>;
  createResource: (params: any) => Promise<void>;
  setSubtrees: (subtrees: Map<string, any>, mapID?: string) => void;
  subtrees: Map<string, any>;
}

/**
 * handleExploreSubmit
 *
 * Processes the user's topic generation request. This includes:
 *  1) Adding the user’s message to the conversation.
 *  2) Exporting study data from the selected node.
 *  3) Sending a request to generateTopic.
 *  4) Parsing the returned response with parseTopicResponse to update the concept map.
 *  5) Adding a success or failure message to the conversation.
 */
async function handleExploreSubmit(params: ExploreSubmitParams) {
  const {
    input,
    exploreMessages,
    setExploreMessages,
    setInput,
    selectedTopic,
    merge,
    exportStudyData,
    focusNodeId,
    activeConceptMapId,
    getModuleSummary,
    docFileID,
    updateNodeTitle,
    setNodes,
    nodes,
    createResource,
    setSubtrees,
    subtrees
  } = params;

  const trimmed = input.trim();
  if (!trimmed) return;

  // Clear the input field in the UI
  setInput('');

  // Add the user's new message to the conversation
  const userMessage: ChatMessage = {
    id: Date.now(),
    type: 'user',
    content: trimmed,
  };
  const updatedMessages = [...exploreMessages, userMessage];

  try {
    // If no node is selected, we cannot proceed
    if (!focusNodeId) {
      throw new Error("No focus node selected for topic generation.");
    }

    // Export the node’s data as context
    const exportData = exportStudyData([focusNodeId]);

    // Retrieve summary information
    const { hasSummary, summary } = getModuleSummary(activeConceptMapId);

    console.log("[ExploreTab] Sending topic generation request with data:", {
      userTopicRequest: trimmed,
      exportData,
      moduleID: activeConceptMapId,
      summary,
      summaryPresent: hasSummary,
      fileID: docFileID,
      merge
    });

    // Make the backend request to generateTopic
    const topicResponse = await generateTopic(
      trimmed,
      exportData,
      activeConceptMapId,
      summary,
      hasSummary,
      docFileID
    );

    console.log("[ExploreTab] Topic generation response received:", topicResponse);

    // Parse the response to update the concept map
    await parseTopicResponse(
      topicResponse,
      {
        updateNodeTitle,
        setNodes,
        nodes,
        createResource,
        setSubtrees,
        subtrees,
        getRootNode: focusNodeId
      },
      activeConceptMapId,
      merge
    );

    // Finally, add a success message to the conversation
    const successMessage: ChatMessage = {
      id: Date.now() + 1,
      type: 'assistant',
      content: "Topic generation complete. The concept map has been updated."
    };
    setExploreMessages([...updatedMessages, successMessage]);

  } catch (error: any) {
    console.error("[ExploreTab] Error in topic generation:", error);
    const failMessage: ChatMessage = {
      id: Date.now() + 2,
      type: 'assistant',
      content: "Failed to generate topic. Please try again later."
    };
    setExploreMessages([...updatedMessages, failMessage]);
  }
}

/**
 * ExploreTab
 *
 * Combines the UI (ExploreTabUI) and the submission handler (handleExploreSubmit).
 */
const ExploreTab = {
  UI: ExploreTabUI,
  handleExploreSubmit,
};

export default ExploreTab;
