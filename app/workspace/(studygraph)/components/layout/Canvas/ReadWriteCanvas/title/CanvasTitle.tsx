import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { useLessonModule } from '@/app/Library/Context/LessonModuleContext';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import './CanvasTitle.css'; 

interface CanvasTitleProps {
  mode: 'edit' | 'readonly';
  isSaving?: boolean;
}

const CanvasTitle: React.FC<CanvasTitleProps> = ({ mode, isSaving = false }) => {
  const { activeConceptMapId, getLessonModule, updateConceptMapTitle } = useLessonModule();
  const { getVisibility } = useYDoc();

  // 1. Context Logic (Identical to original)
  const isPrivate = getVisibility() === 'private';
  const lessonModule = getLessonModule();
  const currentMap = useMemo(
    () => lessonModule.conceptMaps.find((c) => c.id === activeConceptMapId),
    [lessonModule.conceptMaps, activeConceptMapId]
  );
  const currentTitle = currentMap?.title || 'Untitled Lesson';

  // 2. Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(currentTitle);

  useEffect(() => {
    if (!isEditing) {
      setTitleDraft(currentTitle);
    }
  }, [currentTitle, isEditing]);

  const commitTitleEdit = useCallback(() => {
    if (mode !== 'edit') return;
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== currentTitle) {
      updateConceptMapTitle(activeConceptMapId, trimmed);
    }
    setIsEditing(false);
  }, [mode, titleDraft, currentTitle, updateConceptMapTitle, activeConceptMapId]);

  return (
    <div className="canvas-title-overlay">
      {/* View Mode Wrapper (Matches old .canvas-header__titlewrap) */}
      <div
        className="canvas-title__wrapper"
        onClick={() => {
          if (mode === 'edit' && !isSaving) {
            setIsEditing(true);
          }
        }}
        title={isSaving ? 'Saving…' : currentTitle}
        aria-disabled={mode !== 'edit' || isSaving || isEditing}
      >
        <span className="canvas-title__text">{currentTitle}</span>
        
        {isPrivate && <Lock size={16} className="canvas-title__lock" />}
        
        {mode === 'edit' && isSaving && (
          <span className="canvas-title__saving" aria-live="polite">
            <Loader2 size={14} className="ch-spin" />
            <span className="ch-saving-text">Saving…</span>
          </span>
        )}
      </div>

      {/* Edit Mode Overlay (Matches old .canvas-header__editpop) */}
      {mode === 'edit' && isEditing && !isSaving && (
        <div className="canvas-title__editpop">
          <textarea
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitleEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitTitleEdit();
              } else if (e.key === 'Escape') {
                setIsEditing(false);
              }
            }}
            className="canvas-title__editbox"
            rows={2}
            autoFocus
          />
        </div>
      )}
    </div>
  );
};

export default CanvasTitle;