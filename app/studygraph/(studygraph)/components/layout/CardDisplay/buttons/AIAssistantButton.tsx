import React from 'react';
import { Bot, MessageCircle, Sparkles, BookOpen } from 'lucide-react';

interface AIAssistantButtonProps {
  className?: string;
}

const AIAssistantButton: React.FC<AIAssistantButtonProps> = ({ className }) => {
  const handleAction = (action: () => void) => {
    action();
  };

  return (
    <div className="group inline-block relative">
      <button
        type="button"
        className={`flex items-center gap-1.5 whitespace-nowrap font-medium transition-colors 
          bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 
          text-white rounded-md px-2.5 py-1.5 h-8 text-sm focus:outline-none ${className}`}
      >
        <Bot className="h-4 w-4 stroke-[1.5]" />
        AI Assistant
      </button>
      {/* Bridge to prevent menu from closing */}
      <div className="absolute w-full h-2 -bottom-2" />
      <div className="absolute right-0 mt-1 w-40 bg-white shadow-lg rounded-md z-10 hidden group-hover:block border border-gray-200 py-1">
        <button
          type="button"
          onClick={() => handleAction(() => console.log('Opening AI question interface'))}
          className="w-full text-left px-2.5 py-1.5 text-sm flex items-center gap-2.5 hover:bg-gray-50 transition-colors"
        >
          <MessageCircle className="h-4 w-4 text-violet-600 stroke-[1.5]" />
          <span className="text-gray-700">Ask Question</span>
        </button>
        <button
          type="button"
          onClick={() => handleAction(() => console.log('Generating new topic with AI'))}
          className="w-full text-left px-2.5 py-1.5 text-sm flex items-center gap-2.5 hover:bg-gray-50 transition-colors"
        >
          <Sparkles className="h-4 w-4 text-purple-600 stroke-[1.5]" />
          <span className="text-gray-700">Generate Topic</span>
        </button>
        <button
          type="button"
          onClick={() => handleAction(() => console.log('Creating AI-generated quiz'))}
          className="w-full text-left px-2.5 py-1.5 text-sm flex items-center gap-2.5 hover:bg-gray-50 transition-colors"
        >
          <BookOpen className="h-4 w-4 text-indigo-600 stroke-[1.5]" />
          <span className="text-gray-700">Create Quiz</span>
        </button>
      </div>
    </div>
  );
};

export default AIAssistantButton;