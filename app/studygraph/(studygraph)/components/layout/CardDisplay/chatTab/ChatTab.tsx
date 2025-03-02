/**
 * ChatTab.tsx
 *
 * Updates:
 *   1) Removed the "Quiz" tab entirely.
 *   2) Now only the "Ask" tab is available.
 *   3) Cleaned up references to quiz messages and quiz states.
 *
 * Responsibilities:
 *   - Provide a Q&A chat interface for the user.
 */

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare } from 'lucide-react';
import AskTab from './AskTab'; 
import { useNodeSelection } from '@/app/Library/Context/NodeSelectionContext';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import useExportStudyData from '@/app/studygraph/(studygraph)/components/utils/exportStudyData';

export interface ChatTabProps {}

export type ChatMessageType =
  | 'system'
  | 'reference'
  | 'assistant'
  | 'user'
  | 'conceptNode'
  | 'quizReference';

export interface ChatMessage {
  id: number;
  type: ChatMessageType;
  content: string;
  link?: string;
}

const ChatTab: React.FC<ChatTabProps> = () => {
  // We no longer have multiple tabs; just the "ask" functionality.
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      type: 'assistant',
      content: "Have a question? Ask anything, and I'll provide an explanation."
    }
  ]);
  const [input, setInput] = useState('');

  // Context hooks for the Q/A pipeline
  const { getSelectedNodeIds } = useNodeSelection();
  const { nodes } = useNodesContext();
  const { activeConceptMapId, getModuleSummary } = useLessonModule();
  const { docFileID } = useYDoc();
  const exportStudyData = useExportStudyData();

  // Handle submission for "Ask"
  const handleSubmit = async () => {
    if (!input.trim()) return;

    await AskTab.handleAskSubmit({
      input,
      askMessages: messages,
      setAskMessages: setMessages,
      setInput,
      activeConceptMapId,
      getModuleSummary,
      docFileID: docFileID || ''
    });
  };

  return (
    <div className="h-full flex flex-col select-text">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AskTab.UI messages={messages} />
      </div>

      {/* Footer */}
      <div className="p-4 border-t space-y-3 bg-white select-text">

        {/* Input field + submit button */}
        <div className="flex gap-2">
          <Input
            placeholder="Ask a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSubmit();
              }
            }}
          />
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleSubmit}
          >
            Ask
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatTab;
