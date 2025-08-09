import React from 'react';
import { MessageCircle } from 'lucide-react';

interface AiTutorChatButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  label?: string;
}

const AiTutorChatButton: React.FC<AiTutorChatButtonProps> = ({
  onClick,
  disabled = false,
  isLoading = false,
  className = '',
  label = 'Ask AI Tutor'
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        inline-flex 
        items-center 
        gap-2 
        bg-white 
        border-2 
        border-gray-300 
        rounded-full 
        px-4 
        py-2.5 
        text-sm 
        font-medium 
        text-gray-600 
        transition-all 
        duration-200 
        ease-in-out
        hover:border-blue-500 
        hover:text-blue-500 
        hover:bg-blue-50
        focus:outline-none 
        focus:ring-2 
        focus:ring-blue-500 
        focus:ring-opacity-50
        disabled:opacity-50 
        disabled:cursor-not-allowed 
        disabled:hover:border-gray-300 
        disabled:hover:text-gray-600 
        disabled:hover:bg-white
        ${className}
      `}
      type="button"
      aria-label={isLoading ? 'Loading...' : label}
    >
      {isLoading ? (
        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
      ) : (
        <MessageCircle size={18} />
      )}
      
      <span>
        {isLoading ? 'Connecting...' : label}
      </span>
    </button>
  );
};

export default AiTutorChatButton;