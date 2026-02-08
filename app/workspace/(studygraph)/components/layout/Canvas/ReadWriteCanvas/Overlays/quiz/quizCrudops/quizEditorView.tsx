/**
 * @file QuizEditorView.tsx
 * @description
 * This component provides a dedicated, uniquely scoped full-screen editing interface for quiz resources. 
 * Its primary responsibility is to transform static quiz data into an interactive form while ensuring 
 * that its stylistic rules do not interfere with the global quiz-taker components. RECENT UPDATES: 
 * The component has been entirely refactored to use the 'qev-' CSS namespace to prevent class collision 
 * with QuizStyles.css. It maintains a vertical flexbox architecture that pins the action footer to the 
 * absolute bottom of the viewport, solving previous floating layout issues. Action buttons are now 
 * strictly right-aligned in the footer. The component leverages the useQuizCRUD hook for volatile 
 * buffering, ensuring data integrity by only committing changes to the ResourceContext upon a 
 * successful "Save Changes" trigger.
 */

import React from 'react';
import { Trash2, Save } from 'lucide-react';
import { IQuizQuestion } from '@/app/Library/Definitions/Definitions';
import { useQuizCRUD } from './useQuizCrud';
// 1. Keep global styles for variable access, but rely on local CSS for layout
import '@/app/workspace/(studygraph)/components/utils/quiz/QuizStyles.css';
import './QuizEditorView.css';

interface QuizEditorViewProps {
  initialQuestions: IQuizQuestion[];
  onSave: (updatedQuestions: IQuizQuestion[]) => void;
  onCancel: () => void;
}

const QuizEditorView: React.FC<QuizEditorViewProps> = ({
  initialQuestions,
  onSave,
  onCancel,
}) => {
  // 2. Consume the local CRUD logic for managing the buffered draft array
  const { draftQuestions, handleFieldChange, handleRemoveItem } = useQuizCRUD(initialQuestions);

  /**
   * @function handleCommitSave
   * @description
   * Finalizes the editing session by passing the accumulated draft state to the parent context handler. 
   * It logs a specific 4-digit telemetry code [8401] to capture the delta in question count, 
   * which is essential for monitoring user content patterns and debugging accidental mass deletions 
   * in a production environment.
   */
  const handleCommitSave = () => {
    // 3. Log telemetry for the batch save operation
    console.log('[QuizEditorView.tsx][8401] Scoped batch commit initiated', {
      originalCount: initialQuestions.length,
      finalCount: draftQuestions.length
    });
    onSave(draftQuestions);
  };

  return (
    <div className="qev-main-container">
      
      {/* 4. Scoped Scrollable Area: Middle flex section that pushes footer to bottom */}
      <div className="qev-scrollable-content quiz-scrollbar">
        <div className="qev-list-inner">
          {draftQuestions.map((q, index) => (
            <div key={q.id} className="qev-question-card">
              <div className="qev-card-header">
                <span className="qev-question-index">Question {index + 1}</span>
                
                {/* 5. Explicit Delete Interaction: Red Trash icon + Scoped Label */}
                <button 
                  onClick={() => handleRemoveItem(q.id)}
                  className="qev-delete-trigger"
                  title="Remove this question"
                >
                  <Trash2 size={16} />
                  <span>Delete</span>
                </button>
              </div>

              {/* 6. Form Inputs using scoped field names to avoid QuizStyles contention */}
              <div className="qev-form-fields">
                <div className="qev-input-group">
                  <label className="qev-field-label">Question Text</label>
                  <textarea
                    className="qev-text-area"
                    value={q.question}
                    onChange={(e) => handleFieldChange(q.id, 'question', e.target.value)}
                  />
                </div>

                <div className="qev-input-group">
                  <label className="qev-field-label">Correct Answer</label>
                  <input
                    type="text"
                    className="qev-single-input"
                    value={String(q.correctAnswer)}
                    onChange={(e) => handleFieldChange(q.id, 'correctAnswer', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 7. Scoped Fixed Footer: Permanently anchored with right-aligned actions */}
      <div className="qev-fixed-footer">
        <div className="qev-action-group-right">
          <button onClick={onCancel} className="quiz-btn quiz-btn-secondary">
            Cancel
          </button>
          <button 
            onClick={handleCommitSave} 
            className="quiz-btn quiz-btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizEditorView;