/**
 * @file SlideShowEditForm.tsx
 * @description
 * Full-screen edit form component designed to replace the entire slideshow dialog during editing.
 * This component provides a spacious, dedicated editing environment that maximizes readability
 * and usability by taking over the complete slideshow modal space. Instead of nesting within
 * the slide content area, this form becomes the primary modal content, providing ample space
 * for the rich text editor, form fields, and proper visual hierarchy. The design prioritizes
 * readability with generous spacing, clear typography, and intuitive layout that makes editing
 * a pleasant experience. The component maintains all existing functionality while dramatically
 * improving the visual design and user experience. It integrates seamlessly with existing
 * CRUD operations and validation systems while providing a professional, full-featured editing
 * interface that rivals dedicated document editors. The full-screen approach ensures users
 * can focus entirely on their content without the distraction of cramped nested interfaces.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Save, X, ArrowLeft } from 'lucide-react'; // (update - 6) removed Settings import
import RichTextEditor from '@/components/RichTextEditor';
import useCardCrudOperations from '@/app/studygraph/(studygraph)/components/hooks/useCardCrudOperations';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';
import type { 
  ResourceCard,
  CueCardResource, 
  NoteResource, 
  PracticeSheetResource 
} from '@/app/Library/Definitions/Definitions';
import type { ResourceFormInput } from '../types/resourceForm';
import './SlideShowEditForm.css'; // (update - 2)

export interface SlideShowEditFormProps {
  /** The resource card being edited */
  slide: ResourceCard;
  /** Callback when save operation is completed */
  onSave: () => void;
  /** Callback when edit operation is cancelled */
  onCancel: () => void;
}

/**
 * getResourceContent
 * Safely extracts content from a ResourceCard based on its type.
 * Handles the discriminated union properly to avoid TypeScript errors.
 * @param slide The resource card to extract content from
 * @returns The content as a string
 */
function getResourceContent(slide: ResourceCard): string {
  switch (slide.type) {
    case 'cueCard':
      return (slide as CueCardResource).content;
    case 'note':
      return (slide as NoteResource).content;
    case 'practiceSheet':
      return JSON.stringify((slide as PracticeSheetResource).content);
    default:
      return '';
  }
}

/**
 * SlideShowEditForm
 * Full-screen edit form that replaces the entire slideshow dialog.
 * Provides maximum space and optimal readability for content editing.
 */
const SlideShowEditForm: React.FC<SlideShowEditFormProps> = ({
  slide,
  onSave,
  onCancel,
}) => {
  console.log('[SlideShowEditForm.tsx][4001] Initializing full-screen edit form for slide:', slide.id);

  // 1. Get necessary hooks and context
  const { updateResource } = useCardCrudOperations();
  const { getNodeTitle } = useNodesContext();

  // 2. Local state management for edit form
  const [editingFields, setEditingFields] = useState({
    title: slide.title,
    content: getResourceContent(slide),
  });

  const [inputData, setInputData] = useState<ResourceFormInput>({
    selectedTopicId: slide.nodeId,
    createNode: false,
    nodeTitle: '',
    file: undefined,
  });

  const [isValid, setIsValid] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // (update - 7) removed unused settings handler

  // 3. Initialize content based on slide type
  useEffect(() => {
    console.log('[SlideShowEditForm.tsx][4002] Setting up initial content for type:', slide.type);
    
    setEditingFields({
      title: slide.title,
      content: getResourceContent(slide),
    });
  }, [slide]);

  // 4. Validation logic
  useEffect(() => {
    const titleValid = editingFields.title.trim() !== '';
    const contentValid = editingFields.content.trim() !== '';
    setIsValid(titleValid && contentValid);
  }, [editingFields]);

  /**
   * handleSave
   * Processes the save operation by updating the resource through existing CRUD operations.
   * Maintains consistency with EditTab save behavior and handles all resource types.
   */
  const handleSave = useCallback(async () => {
    if (!isValid || isSaving) {
      console.log('[SlideShowEditForm.tsx][4003] Save blocked - invalid form or already saving');
      return;
    }

    console.log('[SlideShowEditForm.tsx][4004] Starting save operation for slide:', slide.id);
    setIsSaving(true);

    try {
      // 1. Create type-safe update object based on resource type
      let updates: any = {
        title: editingFields.title,
        newImage: !!inputData.file,
      };

      // 2. Add image file if present
      if (inputData.file) {
        updates.image = inputData.file;
      }

      // 3. Handle content based on resource type with proper type safety
      switch (slide.type) {
        case 'cueCard':
        case 'note':
          updates.content = editingFields.content;
          break;
        case 'practiceSheet':
          try {
            updates.content = JSON.parse(editingFields.content);
          } catch {
            updates.content = editingFields.content;
          }
          break;
        default:
          updates.content = editingFields.content;
      }

      // 4. Execute update through existing CRUD operations
      await updateResource(slide, updates);
      
      console.log('[SlideShowEditForm.tsx][4005] Save operation completed successfully');
      onSave();
      
    } catch (error) {
      console.error('[SlideShowEditForm.tsx][4006] Save operation failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, [slide, editingFields, inputData, isValid, isSaving, updateResource, onSave]);

  /**
   * handleCancel
   * Cancels the edit operation and returns to view mode without saving changes.
   */
  const handleCancel = useCallback(() => {
    console.log('[SlideShowEditForm.tsx][4007] Cancelling edit operation');
    onCancel();
  }, [onCancel]);

  // 5. Get concept node title for display
  const conceptNodeTitle = getNodeTitle(slide.nodeId) || 'Unknown Topic';

  // 6. Render content editor based on slide type
  const renderContentEditor = () => {
    return (
      <RichTextEditor
        content={editingFields.content}
        onChange={(content) => setEditingFields(prev => ({ ...prev, content }))}
        className="min-h-[400px]"
      />
    );
  };

  return (
    <div className="slideshow-edit-fullscreen" role="dialog" aria-modal="true">
      {/* Header (navigation/context only) */}
      <header className="slideshow-edit-fullscreen-header">
        <div className="slideshow-edit-header-left">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="slideshow-edit-back-btn"
            title="Back to slideshow"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="slideshow-edit-title-info">
            <h1 className="slideshow-edit-main-title">
              Editing: {slide.title}
            </h1>
            <p className="slideshow-edit-topic-name">
              Topic: {conceptNodeTitle}
            </p>
          </div>
        </div>

        {/* (update - 8) Header tools: close only (gear removed) */}
        <div className="slideshow-edit-header-tools">
          <button
            type="button"
            className="slideshow-edit-close-btn"
            onClick={handleCancel}
            title="Close editor"
            aria-label="Close"
            disabled={isSaving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="slideshow-edit-fullscreen-body">
        <div className="slideshow-edit-content-container">
          
          {/* Title Section */}
          <div className="slideshow-edit-section">
            <label className="slideshow-edit-label">
              Title
            </label>
            <input
              type="text"
              value={editingFields.title}
              onChange={(e) => setEditingFields(prev => ({ ...prev, title: e.target.value }))}
              className="slideshow-edit-title-input"
              placeholder="Enter title..."
            />
            {editingFields.title.trim() === '' && (
              <p className="slideshow-edit-error-text">
                Title cannot be empty
              </p>
            )}
          </div>

          {/* Content Section */}
          <div className="slideshow-edit-section slideshow-edit-content-section">
            <label className="slideshow-edit-label">
              Content
            </label>
            <div className="slideshow-edit-content-wrapper">
              {renderContentEditor()}
            </div>
            {editingFields.content.trim() === '' && (
              <p className="slideshow-edit-error-text">
                Content cannot be empty
              </p>
            )}
          </div>

        </div>
      </main>

      {/* (update - 9) Footer anchored at bottom via flex (not sticky) */}
      <footer className="slideshow-edit-footer" aria-label="Editor actions">
        <div className="slideshow-edit-footer-inner">
          <button
            type="button"
            className="btn-secondary-outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={!isValid || isSaving}
          >
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default SlideShowEditForm;
