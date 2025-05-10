// QuizBase.tsx
import React from 'react';
import { X } from 'lucide-react';

interface QuizBaseProps {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
  showScore: boolean;
  footerContent?: React.ReactNode;
}

const QuizBase: React.FC<QuizBaseProps> = ({ 
  children, 
  title, 
  onClose, 
  showScore,
  footerContent 
}) => {
  return (
    <div className="fixed inset-0 z-50">
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={showScore ? undefined : onClose}
      />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-[90vh] bg-white rounded-lg shadow-xl flex flex-col">
        {/* Header - Fixed at top */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="text-xl font-semibold">{title}</h2>
          {!showScore && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        
        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
        
        {/* Footer - Fixed at bottom */}
        {footerContent && (
          <div className="shrink-0 p-4 border-t border-gray-200 bg-white">
            {footerContent}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizBase;