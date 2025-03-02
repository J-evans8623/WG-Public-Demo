import React from 'react';
import { Link2 } from 'lucide-react';
import { ChatMessage } from './ChatTab';
import SafeContent from '@/app/studygraph/(studygraph)/components/utils/SafeContent';

/**
 * QuizTabUIProps
 *
 * - messages: The array of chat messages for the Quiz tab
 * - selectedTopic: A comma-separated string of all selected node titles
 */
interface QuizTabUIProps {
  messages: ChatMessage[];
  selectedTopic: string;
}

/**
 * QuizOutput
 *
 * Subcomponent to display a newly created quiz reference message
 * with a green highlight box.
 */
const QuizOutput: React.FC<{ message: ChatMessage }> = ({ message }) => {
  return (
    <div className="flex flex-col w-full max-w-2xl p-4 bg-white rounded-lg shadow">
      <div className="mb-3 text-gray-700">{message.content}</div>
      <div className="p-4 mb-3 bg-green-50 rounded-lg border border-green-200">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-green-600"
            >
              <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"></path>
              <path d="M8 10h8"></path>
              <path d="M12 6v8"></path>
            </svg>
          </div>
          <div className="flex-grow">
            <div className="font-medium text-lg text-green-700">New Quiz</div>
            <div className="text-sm text-gray-600">
              10 questions • Multiple choice • Estimated time: 15 min
            </div>
          </div>
          <button className="px-4 py-2 bg-green-600 text-white font-medium rounded hover:bg-green-700">
            Open Quiz
          </button>
        </div>
        <div className="mt-3 text-sm text-gray-600">
          Topics covered: [e.g. Activation Functions, Backpropagation, etc.]
        </div>
      </div>
    </div>
  );
};

/**
 * QuizTabUI
 *
 * Displays the Quiz tab conversation, including:
 * - A single link icon for the selected topics
 * - An ellipsis (...) if the topic list exceeds a threshold
 */
const QuizTabUI: React.FC<QuizTabUIProps> = ({ messages, selectedTopic }) => {
  if (!messages || messages.length === 0) return null;

  // Parse the comma-separated topics
  const topics = selectedTopic
    ? selectedTopic.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  // Limit the number of topics shown to avoid excessive space usage
  const MAX_TOPICS_TO_DISPLAY = 3;
  const displayedTopics = topics.slice(0, MAX_TOPICS_TO_DISPLAY);
  const hasEllipsis = topics.length > MAX_TOPICS_TO_DISPLAY;

  return (
    <>
      {messages[0].type === 'assistant' && (
        <div key={messages[0].id} className="select-text">
          {/* Show one link icon + a single line for the selected topics */}
          {topics.length > 0 && (
            <div className="mb-2 flex items-center text-sm text-blue-600">
              <Link2 className="w-4 h-4 text-blue-500 mr-1" />
              <span>
                Selected Topics: {displayedTopics.join(', ')}
                {hasEllipsis && '...'}
              </span>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg p-3 w-full shadow-sm select-text">
            <SafeContent
              html={messages[0].content}
              className="text-sm prose max-w-none text-gray-800 select-text"
            />
          </div>
        </div>
      )}

      {/* Render subsequent messages */}
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
        } else if (msg.type === 'quizReference') {
          return (
            <div key={msg.id}>
              <QuizOutput message={msg} />
            </div>
          );
        } else {
          // system, reference, or other messages
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
 * QuizSubmitParams
 *
 * - input: The user's input text
 * - quizMessages: The current Quiz tab messages
 * - setQuizMessages: Function to update quizMessages
 * - setInput: Function to clear or change the user input
 * - selectedTopic: Comma-separated list of selected topics
 */
interface QuizSubmitParams {
  input: string;
  quizMessages: ChatMessage[];
  setQuizMessages: (msgs: ChatMessage[]) => void;
  setInput: (val: string) => void;
  selectedTopic: string;
}

/**
 * handleQuizSubmit
 *
 * Called when the user sends a message on the Quiz tab.
 * Adds the user's message, then simulates creation of a "quizReference".
 */
async function handleQuizSubmit({
  input,
  quizMessages,
  setQuizMessages,
  setInput,
  selectedTopic
}: QuizSubmitParams) {
  const trimmed = input.trim();
  if (!trimmed) return;

  setInput('');

  // Add the user's message
  const userMessage: ChatMessage = {
    id: Date.now(),
    type: 'user',
    content: trimmed
  };
  const updated = [...quizMessages, userMessage];

  try {
    // Simulate an AI or backend call that returns a quiz reference
    const quizReferenceMessage: ChatMessage = {
      id: Date.now() + 1,
      type: 'quizReference',
      content: `I've created a quiz on "${trimmed}" based on our discussion. You can access it using the link below.`,
      link: selectedTopic
    };
    setQuizMessages([...updated, quizReferenceMessage]);
  } catch (error) {
    console.error("[QuizTab] Error creating quiz:", error);
    const failMessage: ChatMessage = {
      id: Date.now() + 2,
      type: 'assistant',
      content: "Failed to create a quiz. Please try again later."
    };
    setQuizMessages([...updated, failMessage]);
  }
}

/**
 * QuizTab
 *
 * Bundles both the UI component and the submission logic for the Quiz tab.
 */
const QuizTab = {
  UI: QuizTabUI,
  handleQuizSubmit
};

export default QuizTab;
