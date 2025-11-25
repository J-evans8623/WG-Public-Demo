// BottomActions.tsx

import React from 'react';
import { MessageCircle, Bookmark, Play, CheckCircle2 } from 'lucide-react';

export interface BottomActionsProps {
  /** Open the discussion/forum modal */
  onDiscuss: () => void;
  /** Open the bookmark modal */
  onBookmark: () => void;
  /** Launch the lesson slideshow (“view all slides”) */
  onStartLesson: () => void;
  /** Launch the review workflow/modal */
  onStartReview: () => void;
}

const BottomActions: React.FC<BottomActionsProps> = ({
  onDiscuss,
  onBookmark,
  onStartLesson,
  onStartReview
}) => {
  return (
    <div className="flex gap-3 justify-center p-5 bg-white  mt-6">
      <button 
        onClick={onDiscuss}
        className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-all duration-200 text-sm"
        title="Discuss"
      >
        <MessageCircle className="w-4 h-4" />
        Discuss
      </button>
      
      <button 
        onClick={onStartLesson}
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-all duration-200 text-sm"
        title="Start Lesson"
      >
        <Play className="w-4 h-4" />
        Start Lesson
      </button>
      
      <button 
        onClick={onStartReview}
        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-md hover:bg-emerald-700 transition-all duration-200 text-sm"
        title="Start Review"
      >
        <CheckCircle2 className="w-4 h-4" />
        Start Review
      </button>
      
      <button 
        onClick={onBookmark}
        className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-all duration-200 text-sm"
        title="Bookmarks"
      >
        <Bookmark className="w-4 h-4" />
        Bookmarks
      </button>
    </div>
  );
};

export default BottomActions;
