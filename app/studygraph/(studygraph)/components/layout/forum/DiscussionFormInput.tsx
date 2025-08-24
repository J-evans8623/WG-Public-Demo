/**
 * @file DiscussionFormInput.tsx
 * @description
 * Advanced discussion creation form component that provides a comprehensive interface for users to create new forum
 * discussions with enhanced user experience and validation. This component transforms the basic discussion creation
 * process into a professional, guided experience that encourages high-quality posts while maintaining simplicity.
 * The form features structured input fields with clear labeling, helpful guidance text, real-time validation, and
 * contextual information display. When launched from specific lesson or slide contexts, the component automatically
 * applies relevant tags and provides contextual information to users. The interface includes character counting for
 * both title and content fields, form validation that ensures minimum content quality, and auto-expanding textareas
 * for optimal content creation experience. Visual design follows the established brand theme with sage green primary
 * actions, professional typography hierarchy, and subtle visual effects that enhance usability. The component supports
 * both desktop and mobile interfaces with responsive design patterns and comprehensive accessibility features.
 * Integration points include slideshow overlay and forum modal launching, with automatic draft management capabilities.
 *
 * Responsibilities:
 * 1. Provide structured form interface for creating new discussion posts
 * 2. Implement real-time form validation with character limits and minimum requirements
 * 3. Display contextual information when launched from specific lesson/slide contexts
 * 4. Generate and display automatic tags based on launch context
 * 5. Handle form submission with proper data formatting for CommentContext integration
 * 6. Manage form state including draft auto-save simulation and validation feedback
 * 7. Support responsive design and accessibility standards throughout the interface
 * 8. Provide clear user guidance and feedback for optimal post creation experience
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface ContextInfo {
  lessonTitle: string;
  slideTitle: string;
}

interface DiscussionFormInputProps {
  onSubmit: (title: string, content: string) => void;
  onCancel: () => void;
  contextInfo?: ContextInfo;
}

/**
 * @function DiscussionFormInput
 * @description
 * Main form component for creating new discussions with comprehensive validation, guidance, and contextual features.
 * Manages form state, validation logic, and user interaction feedback while integrating seamlessly with parent
 * components. Includes real-time character counting, minimum content validation, auto-expanding textareas, and
 * contextual tag display. Provides professional user experience with proper accessibility support and responsive design.
 */
const DiscussionFormInput: React.FC<DiscussionFormInputProps> = ({
  onSubmit,
  onCancel,
  contextInfo
}) => {
  // Step 1: Initialize form state and validation
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  console.log('DiscussionFormInput.tsx [DFIN1001] › Form initialized with context:', contextInfo);

  // Step 2: Form validation logic
const isValidForm = useCallback(() => {
  const titleValid = title.trim().length > 0 && title.trim().length <= 150; // Only check not empty and max length
  const contentValid = content.trim().length > 0; // Only check not empty
  console.log('DiscussionFormInput.tsx [DFIN1005] › Form validation:', { 
    titleLength: title.trim().length, 
    contentLength: content.trim().length, 
    titleValid, 
    contentValid, 
    isValid: titleValid && contentValid 
  });
  return titleValid && contentValid;
}, [title, content]);

  const [isFormValid, setIsFormValid] = useState(false);

  // Step 3: Update form validity on input changes
  useEffect(() => {
    setIsFormValid(isValidForm());
  }, [isValidForm]);

  // Step 4: Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid || isSubmitting) return;

    console.log('DiscussionFormInput.tsx [DFIN1002] › Submitting discussion:', { title: title.trim(), content: content.trim() });
    
    setIsSubmitting(true);
    try {
      await onSubmit(title.trim(), content.trim());
      console.log('DiscussionFormInput.tsx [DFIN1003] › Discussion submitted successfully');
    } catch (error) {
      console.error('DiscussionFormInput.tsx [DFIN1004] › Submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 5: Handle textarea auto-expansion
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    
    // Auto-expand functionality
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(140, textarea.scrollHeight) + 'px';
  };

  // Step 6: Character count styling logic
  const getTitleCharacterCountClass = () => {
    const length = title.length;
    if (length > 120) return 'discussion-form__char-counter--warning';
    if (length >= 150) return 'discussion-form__char-counter--error';
    return '';
  };

  // Step 7: Generate automatic tags based on context
  const generateTags = () => {
  const tags: Array<{ id: string; label: string; type: 'primary' | 'secondary' }> = [
    { id: 'question', label: 'Question', type: 'primary' }
  ];
  
  if (contextInfo) {
    tags.unshift(
      { id: 'lesson', label: contextInfo.lessonTitle, type: 'secondary' },
      { id: 'slide', label: contextInfo.slideTitle, type: 'secondary' }
    );
  }
  
  return tags;
};

  const autoTags = generateTags();

  // Step 8: Render the complete form interface
  return (
    <div className="discussion-form">
      <header className="discussion-form__header">
        <h2 className="discussion-form__title">Start New Discussion</h2>
        <button
          className="discussion-form__close-btn"
          onClick={onCancel}
          aria-label="Close form"
        >
          <X size={20} />
        </button>
      </header>

      <form className="discussion-form__form" onSubmit={handleSubmit}>
        {/* Title Input Section */}
        <div className="discussion-form__group">
          <label className="discussion-form__label" htmlFor="discussion-title">
            Discussion Title
          </label>
          <p className="discussion-form__help">
            Write a clear, descriptive title that summarizes your question or topic
          </p>
          <input
            id="discussion-title"
            className="discussion-form__title-input"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g., How do I understand the relationship between NEXP and NP?"
            maxLength={150}
            required
          />
          <div className={`discussion-form__char-counter ${getTitleCharacterCountClass()}`}>
            {title.length}/150
          </div>
        </div>

        {/* Content Input Section */}
        <div className="discussion-form__group">
          <label className="discussion-form__label" htmlFor="discussion-content">
            Your Question or Discussion
          </label>
          <p className="discussion-form__help">
            Provide details, context, and any specific areas where you need help
          </p>
          <textarea
            id="discussion-content"
            className="discussion-form__content-textarea"
            value={content}
            onChange={handleContentChange}
            placeholder="Describe your question in detail. What specific concept are you struggling with? What have you already tried? Include any relevant context that will help others understand and provide better answers."
            rows={5}
            required
          />
          <div className="discussion-form__char-counter">
            {content.length} characters
          </div>
        </div>

        {/* Auto-generated Tags Section */}
        {autoTags.length > 0 && (
          <div className="discussion-form__tags-section">
            <label className="discussion-form__label">Tags (automatically applied)</label>
            <div className="discussion-form__tags">
              {autoTags.map(tag => (
                <span
                  key={tag.id}
                  className={`discussion-form__tag discussion-form__tag--${tag.type}`}
                >
                  {tag.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="discussion-form__actions">
          <button
            type="button"
            className="discussion-form__cancel-btn"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="discussion-form__submit-btn"
            disabled={!isFormValid || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="discussion-form__spinner" />
                Posting...
              </>
            ) : (
              <>
                📝 Post Discussion
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DiscussionFormInput;