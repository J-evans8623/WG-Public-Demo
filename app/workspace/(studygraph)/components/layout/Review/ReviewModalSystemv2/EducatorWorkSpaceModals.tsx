/***************************************************************************************************
 * @file EducatorWorkSpaceModals.tsx
 * @description
 * (update - 1.1)
 * This component has been refactored to patch a critical RBAC regression that prevented Scholar 
 * account types from accessing the Assessment interface. The core responsibility of this 
 * orchestrator is to manage the visibility of workspace-level administrative and scholarship 
 * modals. The regression was caused by an over-zealous 'isEducator' guard applied to the 
 * Assessment modal rendering block. In this version, we have removed that guard for the 
 * Assessment surface, as 'AssessmentTab' is designed to be polymorphic—providing 
 * educator-specific management tools for teachers and quiz-viewing tools for students. 
 * The Gradebook workflow remains delegated to the 'GradesOrchestrator', which handles 
 * its own internal account-type branching. This ensures all user roles can access 
 * their respective functional views without unauthorized privilege escalation.
 ***************************************************************************************************/

import React from 'react';
import AssessmentTab from '@/app/workspace/(studygraph)/components/layout/Review/ReviewModalSystemv2/AssessmentTab';
import GradesOrchestrator from '@/app/workspace/(studygraph)/components/layout/quizFeedback/GradesOrchestrator';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useApiContext } from '@/app/src/context/ApiContext';

export interface EducatorWorkSpaceModalsProps {
  isAssessmentOpen: boolean;
  isGradebookOpen: boolean;
  setAssessmentOpen: (open: boolean) => void;
  setGradebookOpen:  (open: boolean) => void;
}

/**
 * EducatorWorkSpaceModals
 * @description
 * Headless orchestrator for administrative and grade-related modals. (update - 1.2) 
 * Refactored to restore Scholar access to the Assessment tab by removing the 
 * top-level 'isEducator' rendering gate.
 */
const EducatorWorkSpaceModals: React.FC<EducatorWorkSpaceModalsProps> = ({
  isAssessmentOpen,
  isGradebookOpen,
  setAssessmentOpen,
  setGradebookOpen,
}) => {
  const { docFileID } = useYDoc();
  const { accountStatus } = useApiContext();
  const isEducator = accountStatus?.accountType === 'educator';

  /**
   * handleOpenGradebookFromAssessment
   * @description
   * Navigates from Assessment to Grades by toggling visibility flags. Closes the 
   * Assessment modal before opening the Grades surface to prevent UI collisions.
   */
  const handleOpenGradebookFromAssessment = () => {
    setAssessmentOpen(false);
    setGradebookOpen(true);
  };

  if (!docFileID) return null;

  return (
    <>
      {/* update - 1.3: Removed 'isEducator' gate. AssessmentTab internally handles
          role-specific views (Create vs View), so we must allow Scholars to mount it. */}
      {isAssessmentOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-container rms-shell" style={{ width: 560, maxWidth: '92vw' }}>
            <AssessmentTab
              docId={docFileID}
              onClose={() => setAssessmentOpen(false)}
              onViewGradebook={handleOpenGradebookFromAssessment}
            />
          </div>
        </div>
      )}

      {/* update - 1.4: GradesOrchestrator maintains its role-based branching internally. */}
      <GradesOrchestrator
        isOpen={isGradebookOpen}
        onClose={() => setGradebookOpen(false)}
        docId={docFileID}
      />
    </>
  );
};

export default EducatorWorkSpaceModals;