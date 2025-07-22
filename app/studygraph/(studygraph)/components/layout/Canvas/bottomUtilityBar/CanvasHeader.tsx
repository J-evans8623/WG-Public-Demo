// CanvasHeader.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  Menu,
  MessageCircle,
  Play,
  CheckCircle2,
  Bookmark,
  Share2,
  History,
  Lock,
} from 'lucide-react';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useYDoc } from '@/app/Library/Context/YDocContext';

export interface CanvasHeaderProps {
  onMenuToggle: () => void;
  onDiscuss: () => void;
  onStartLesson: () => void;
  onStartReview: () => void;
  onBookmark: () => void;
  onShare: () => void;
  onVersionHistory: () => void;
  isSaving: boolean;
}

const CanvasHeader: React.FC<CanvasHeaderProps> = ({
  onMenuToggle,
  onDiscuss,
  onStartLesson,
  onStartReview,
  onBookmark,
  onShare,
  onVersionHistory,
  isSaving,
}) => {
  const { activeConceptMapId, getLessonModule, updateConceptMapTitle } =
    useLessonModule();
  const { getVisibility } = useYDoc();
  const isPrivate = getVisibility() === 'private';

  const lessonModule = getLessonModule();
  const cm = lessonModule.conceptMaps.find(
    (c) => c.id === activeConceptMapId
  );
  const currentTitle = cm?.title || 'Untitled Lesson';

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(currentTitle);

  useEffect(() => {
    if (!isEditing) setDraft(currentTitle);
  }, [currentTitle, isEditing]);

  const commit = useCallback(() => {
    const t = draft.trim();
    if (t && t !== currentTitle) {
      updateConceptMapTitle(activeConceptMapId, t);
    }
    setIsEditing(false);
  }, [draft, currentTitle, updateConceptMapTitle, activeConceptMapId]);

  // flex parent needs min-w-0 to allow children to shrink
  const titleWrapperClasses = [
    'inline-flex items-center px-4 py-1 bg-white rounded max-w-[40ch] min-w-0',
    isSaving || isEditing
      ? 'opacity-50'
      : 'cursor-pointer hover:bg-gray-100',
  ]
    .filter(Boolean)
    .join(' ');

  const btnBase =
    'flex items-center gap-1 px-3 py-1 text-sm font-medium rounded transition';
  const btnBorder = 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50';
  const btnPrimary = 'bg-blue-600 text-white hover:bg-blue-700';
  const btnSuccess = 'bg-emerald-600 text-white hover:bg-emerald-700';

  return (
    <header className="relative flex items-center justify-between bg-white border-b border-gray-200 px-4 py-2">
      {/* Left: menu + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="p-2 rounded hover:bg-gray-100"
          title="Toggle menu"
        >
          <Menu size={20} />
        </button>

        <div
          className={titleWrapperClasses}
          onClick={() => !isSaving && setIsEditing(true)}
          title={isSaving ? 'Saving…' : currentTitle}
        >
          {/* Span will handle ellipsis */}
          <span className="block truncate">{currentTitle}</span>
          {isPrivate && (
            <Lock size={16} className="text-gray-600 ml-1 flex-shrink-0" />
          )}
        </div>

        {/* Inline editor overlay */}
        {isEditing && !isSaving && (
          <div className="absolute top-10 left-20 z-30">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commit();
                  e.preventDefault();
                }
                if (e.key === 'Escape') {
                  setIsEditing(false);
                }
              }}
              className="
                w-80 h-12
                border border-gray-300
                rounded px-2 py-1
                text-sm
                resize-none
                shadow
                focus:outline-none focus:ring-1 focus:ring-blue-500
                bg-white
              "
              rows={2}
              autoFocus
            />
          </div>
        )}
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-2">
        <button onClick={onDiscuss} className={`${btnBase} ${btnBorder}`}>
          <MessageCircle size={16} /> Discuss
        </button>
        <button onClick={onStartLesson} className={`${btnBase} ${btnPrimary}`}>
          <Play size={16} /> Start Lesson
        </button>
        <button onClick={onStartReview} className={`${btnBase} ${btnSuccess}`}>
          <CheckCircle2 size={16} /> Start Review
        </button>
        <button
          onClick={onBookmark}
          className={`${btnBase} ${btnBorder}`}
          title="Bookmarks"
        >
          <Bookmark size={16} />
        </button>
        <button onClick={onShare} className={`${btnBase} ${btnBorder}`} title="Share">
          <Share2 size={16} />
        </button>
        <button
          onClick={onVersionHistory}
          className={`${btnBase} ${btnBorder}`}
          title="History"
        >
          <History size={16} />
        </button>
      </div>
    </header>
  );
};

export default CanvasHeader;
