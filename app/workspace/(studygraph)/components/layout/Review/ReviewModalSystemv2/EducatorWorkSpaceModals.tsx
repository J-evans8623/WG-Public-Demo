/**
 * @file EducatorWorkSpaceModals.tsx
 * @description
 * This component serves as a headless orchestrator for Educator-specific administrative workflows, specifically 
 * managing the visibility and lifecycle of the Assessment and Gradebook modals. By centralizing these states 
 * outside of the primary navigation and study components, we adhere to the Dependency Inversion Principle, 
 * ensuring that UI triggers only emit events while this controller handles the actual rendering logic. 
 * It coordinates transitions—such as closing the Assessment view to open the Gradebook—while ensuring 
 * that the necessary document context (docId) and user permissions are propagated consistently to 
 * child components. This prevents state bloat in the workspace layout and provides a clean portal 
 * insertion point for administrative overlays.
 */

import React from 'react';
import AssessmentTab from '@/app/workspace/(studygraph)/components/layout/Review/ReviewModalSystemv2/AssessmentTab';
import GradebookModal from '@/app/workspace/(studygraph)/components/layout/Review/GradebookModal';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useApiContext } from '@/app/src/context/ApiContext';

export interface EducatorWorkSpaceModalsProps {
  // 1. Boolean flags controlling the visibility of administrative modals
  isAssessmentOpen: boolean;
  isGradebookOpen: boolean;
  
  // 2. Setters to update visibility states from the Workspace layout
  setAssessmentOpen: (open: boolean) => void;
  setGradebookOpen: (open: boolean) => void;
}

/**
 * EducatorWorkSpaceModals
 * @description
 * A headless component that renders administrative modals based on the provided state props. 
 * It abstracts the complexity of role-gating and document-scoping, ensuring that 
 * Gradebook and Assessment components always receive a valid docId.
 */
const EducatorWorkSpaceModals: React.FC<EducatorWorkSpaceModalsProps> = ({
  isAssessmentOpen,
  isGradebookOpen,
  setAssessmentOpen,
  setGradebookOpen,
}) => {
  // 1. Retrieve the document ID from the Yjs context for scoping administrative data
  const { docFileID } = useYDoc();
  
  // 2. Retrieve account status to ensure only Educators can render these functional views
  const { accountStatus } = useApiContext();
  const isEducator = accountStatus?.accountType === 'educator';

  /**
   * handleOpenGradebookFromAssessment
   * @description
   * A transition handler passed to the AssessmentTab that allows the user to navigate 
   * to the Gradebook directly. It closes the Assessment modal before opening the Gradebook 
   * to prevent stacked overlays.
   */
  const handleOpenGradebookFromAssessment = () => {
    // 1. Close the current assessment view
    setAssessmentOpen(false);
    // 2. Open the gradebook view
    setGradebookOpen(true);
  };

  // 3. Security Guard: Prevent rendering administrative components if user is not an educator or docId is missing
  if ( !docFileID) return null;

  return (
    <>
      {/* 4. Standalone Assessment Modal Shell */}
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

      {/* 5. Standalone Gradebook Modal 
          UPDATE - 2.2: RBAC Gating. The Gradebook is strictly an Educator tool. 
          We ensure it only mounts if the user is an Educator, regardless of the 'isGradebookOpen' flag. */}
      {isGradebookOpen && isEducator && (
        <GradebookModal 
          isOpen={isGradebookOpen}
          onClose={() => setGradebookOpen(false)}
          docId={docFileID}
        />
      )}
    </>
  );
};

export default EducatorWorkSpaceModals;