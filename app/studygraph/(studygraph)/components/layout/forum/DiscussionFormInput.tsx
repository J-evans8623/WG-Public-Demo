/**
 * @file DiscussionFormInput.tsx
 * @description
 * This file renders the discussion composer as a modal **with a robust three-region shell** (Header / Scrollable Body / Fixed Footer)
 * so the action buttons never overlap content and the body is the only scroll area. The component intentionally owns no
 * outer width/height; its parent dialog provides a fixed, predictable size via CSS. Inside that frame we use a flex-column
 * layout where the form acts as the scrollable body and the footer is a sibling that stays compact. This design removes
 * reliance on sticky footers, avoids nested max-height conflicts, and eliminates the “shrunken width” effect caused by
 * competing constraints. Observability logs (DFIN1001–DFIN1005) mark initialization, validation, and submit lifecycle,
 * remaining O(1) per interaction. The component preserves existing visual tokens and keeps logic minimal and deterministic.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
// update - 1: Import encapsulated sizing + shell rules owned by the discussion modal
import './DiscussionInputForm.css'; // update - 1

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
 * Creates the discussion form with validation and **a fixed footer outside the scrollable body**.
 * The form section is the only element that scrolls; header and footer are auto height. This structure
 * prevents content from being obscured by actions and produces consistent sizing regardless of content
 * length, validation messages, or textarea auto-expansion.
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
    const titleValid = title.trim().length > 0 && title.trim().length <= 150;
    const contentValid = content.trim().length > 0;
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

    console.log('DiscussionFormInput.tsx [DFIN1002] › Submitting discussion:', {
      title: title.trim(),
      content: content.trim()
    });

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

      {/* update - 2: The form acts as the scrollable BODY only */}
      <form className="discussion-form__form" onSubmit={handleSubmit}> {/* update - 2 */}
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
      </form>

      {/* update - 3: Fixed, compact FOOTER outside the scrollable form */}
      <div className="discussion-form__footer"> {/* update - 3 */}
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
          onClick={(e) => {
            console.log('DiscussionFormInput.tsx [DFIN1010] › Footer submit click'); /* update - 4 */
          }}
          disabled={!isFormValid || isSubmitting}
          form="" /* not binding by id; we call submit below */ /* update - 4 */
        >
          {isSubmitting ? (
            <>
              <span className="discussion-form__spinner" />
              Posting...
            </>
          ) : (
            <>📝 Post Discussion</>
          )}
        </button>
      </div> {/* update - 3 */}

      {/* update - 5: Small enhancement — allow Enter on footer button to submit programmatically */}
      <script dangerouslySetInnerHTML={{
        __html: `
          (function () {
            try {
              const root = document.currentScript && document.currentScript.parentElement;
              if (!root) return;
              const footerBtn = root.querySelector('.discussion-form__submit-btn');
              const formEl = root.querySelector('.discussion-form__form');
              if (footerBtn && formEl) {
                footerBtn.addEventListener('click', function () {
                  if (formEl.reportValidity && !formEl.reportValidity()) return;
                  formEl.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                });
              }
              console.log('DiscussionFormInput.tsx [DFIN1011] › Footer submit wiring complete');
            } catch (e) {
              console.log('DiscussionFormInput.tsx [DFIN1012] › Footer submit wiring error', e);
            }
          })();
        `
      }} /> {/* update - 5 */}
    </div>
  );
};

export default DiscussionFormInput;
