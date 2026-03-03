/**
 * @file app/workspace/(studygraph)/components/modals/GradesOrchestrator.tsx
 * @description
 *   GradesOrchestrator is a lightweight parent component that acts as the single entry
 *   point wired to the "Grades" button in CanvasHeader. Its sole responsibility is to
 *   resolve the current user's account type and render the correct modal experience:
 *
 *     • Educator account types receive the GradebookModal, which shows the full student ×
 *       assignment gradebook grid together with the new "Quiz Insights" tab that exposes
 *       the EducatorQuizList → EducatorHistogram performance pipeline.
 *
 *     • Scholar account types receive the StudentGradesModal, which shows their personal
 *       quiz attempt history (StudentGradeList) and, when a feedback row is clicked, the
 *       per-question correction breakdown (StudentQuizDetail).
 *
 *   This component intentionally contains no UI of its own — it renders nothing except
 *   whichever child modal is appropriate. Keeping the branching logic here means neither
 *   GradebookModal nor StudentGradesModal needs to know about the other's existence, and
 *   each can evolve independently without risk of cross-concern regressions. The
 *   QuizFeedbackProvider is NOT mounted here; each child modal is responsible for wrapping
 *   its own subtree so that provider lifecycle is tightly coupled to modal open/close.
 *   isOpen and onClose are forwarded verbatim to whichever modal is rendered, preserving
 *   the same prop contract the parent workspace component has always used.
 */

'use client';

import React from 'react';
import { useAccountStatus } from '@/app/src/context/ApiContext';
import GradebookModal from '@/app/workspace/(studygraph)/components/layout/Review/GradebookModal';
import StudentGradesModal from '@/app/workspace/(studygraph)/components/layout/quizFeedback/StudentGradesModal';

// ─────────────────────────────────────────────────────────────────────────────
// [Section 1] Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GradesOrchestratorProps {
  /** Controls whether the active modal is open. Forwarded verbatim to the child modal. */
  isOpen: boolean;
  /** Callback to close the active modal. Forwarded verbatim to the child modal. */
  onClose: () => void;
  /** Workspace document ID used to scope all Firestore and BFF queries. */
  docId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 2] Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GradesOrchestrator
 * @description
 *   Reads the current user's accountType from ApiContext and renders either the educator
 *   GradebookModal or the scholar StudentGradesModal. Performs no rendering of its own;
 *   it is a pure routing node. If accountStatus has not resolved yet, nothing is rendered
 *   to avoid a flash of the wrong modal — the isOpen prop will simply be inactive until
 *   the parent re-renders once the status is available. All props are forwarded unchanged
 *   so that the calling site (the workspace layout) requires no awareness of which modal
 *   is ultimately displayed.
 */
export default function GradesOrchestrator({
  isOpen,
  onClose,
  docId,
}: GradesOrchestratorProps) {
  // Step 1: Resolve the current user's account type to select the correct modal branch.
  const { accountStatus } = useAccountStatus();
  const isEducator = accountStatus?.accountType === 'educator';

  // Step 2: Guard against rendering before accountStatus resolves to prevent a flash
  //         of the wrong modal variant on first open.
  if (!accountStatus) return null;

  // Step 3: Route to the educator gradebook + insights modal.
  if (isEducator) {
    return (
      <GradebookModal
        isOpen={isOpen}
        onClose={onClose}
        docId={docId}
      />
    );
  }

  // Step 4: Route to the scholar personal grades + feedback modal.
  return (
    <StudentGradesModal
      isOpen={isOpen}
      onClose={onClose}
      docId={docId}
    />
  );
}
