/***************************************************************************************************
 * @file StudentGradesModal.tsx
 * @description
 * (update - 1.1)
 * This component has been refactored to act as the primary structural shell for the scholar's 
 * grade management interface. Its core responsibility is to manage navigation between the 
 * attempt list and the feedback detail scenes while maintaining a consistent "Window UI" 
 * experience. This update specifically resolves the "Stale Button" bug by restructuring 
 * the 'gb-header' to ensure the close action is anchored to the top-right. To eliminate 
 * visual redundancy, this parent component now owns the authoritative title for each 
 * scene ('My Grades' vs 'Feedback Summary'), allowing child components to focus 
 * exclusively on data display. It utilizes the existing 'gb-shell' logic to provide 
 * a robust, portal-rendered container that is visually aligned with the educator's 
 * gradebook while providing scholar-specific remediation tools.
 ***************************************************************************************************/

'use client';

import React, { useEffect, useState } from 'react';
import '@/app/workspace/(studygraph)/components/modals/modalStyles.css';
import '@/app/workspace/(studygraph)/components/layout/Review/gradebook.css';
import { QuizFeedbackProvider, useQuizFeedback } from '@/app/Library/Context/QuizFeedbackDataContext';
import StudentGradeList from '@/app/workspace/(studygraph)/components/layout/quizFeedback/StudentGradeList';
import StudentQuizDetail from '@/app/workspace/(studygraph)/components/layout/quizFeedback/StudentQuizDetail';
import { ArrowLeft, RefreshCw } from 'lucide-react'; // update - 1.2: Added back button icon

export interface StudentGradesModalProps {
  isOpen: boolean;
  onClose: () => void;
  docId: string;
}

type StudentScene = 'list' | 'detail';

export default function StudentGradesModal({
  isOpen,
  onClose,
  docId,
}: StudentGradesModalProps) {
  const [scene, setScene] = useState<StudentScene>('list');
  const [selectedAttemptId, setSelectedAttemptId] = useState<string>('');

  useEffect(() => {
    if (!isOpen) {
      setScene('list');
      setSelectedAttemptId('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleViewFeedback = (attemptId: string) => {
    setSelectedAttemptId(attemptId);
    setScene('detail');
    console.log('[StudentGradesModal.tsx][8801] scene -> detail for attempt', attemptId);
  };

  const handleBackToList = () => {
    setScene('list');
    setSelectedAttemptId('');
    console.log('[StudentGradesModal.tsx][8802] scene -> list (back from detail)');
  };

  /**
   * getSceneTitle
   * @description
   * Returns a pedagogically appropriate title based on the active scene. (update - 1.3) 
   * This centralizes title management to prevent duplicated headings in child components.
   * Logic follows the requirement for O(1) decision making.
   */
  const getSceneTitle = (): string => {
    return scene === 'list' ? 'My Grades' : 'Feedback Summary';
  };



  /**
 * HeaderActions
 * Internal sub-component to consume the QuizFeedback context safely
 */
function HeaderActions({ docId, onClose, scene }: { docId: string; onClose: () => void; scene: StudentScene }) {
  const { fetchStudentAttempts, isLoading } = useQuizFeedback();

  return (
    <div className="gb-header-actions">
      {/* Placement logic: This button appears to the LEFT of the close '×' button 
         because it is rendered first within the flex container.
      */}
      {scene === 'list' && (
        <button 
          className="tertiary-button-grades" 
          onClick={() => fetchStudentAttempts(docId)}
          disabled={isLoading}
        >
          <span>Refresh</span>
          <RefreshCw size={16} className={isLoading ? 'qf-spin' : ''} />
        </button>
      )}

      <button className="gb-close" onClick={onClose} aria-label="Close grades">
        ×
      </button>
    </div>
  );
}

  return (

      <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="My Grades">
        <div className="modal-container gb-shell" style={{ width: '92vw', maxWidth: 1280 }}>
          
          {/* update - 1.4: Refactored header to anchor close button to the right and show unified title */}
          <div className="gb-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Show Back Button only in Detail mode */}
              {scene === 'detail' && (
                <button 
                  onClick={handleBackToList}
                  className="gb-close" 
                  title="Back to List"
                  style={{ display: 'flex', alignItems: 'center', padding: '4px' }}
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <h2 className="modal-title" style={{ margin: 0, fontSize: '20px' }}>
                {getSceneTitle()}
              </h2>
            </div>

            <HeaderActions docId={docId} onClose={onClose} scene={scene} />
          </div>

          {/* update - 1.5: Applied 'flex: 1' and 'min-height: 0' to body to allow inner child to own scrolling */}
          <div className="gb-body" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {scene === 'list' ? (
              <StudentGradeList
                docId={docId}
                onViewFeedback={handleViewFeedback}
              />
            ) : (
              <StudentQuizDetail
                docId={docId}
                attemptId={selectedAttemptId}
                onBack={handleBackToList}
              />
            )}
          </div>
        </div>
      </div>
  );
}