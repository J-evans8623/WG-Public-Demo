/**
 * @file app/workspace/(studygraph)/components/quizFeedback/StudentGradeList.tsx
 * @description
 *   View ① in the QuizFeedback feature. Renders a tabular list of a scholar's
 *   submitted quiz attempts, showing Lesson, Quiz title, Date, Grade, and a
 *   conditional "View Feedback →" action for attempts that have AI-generated
 *   feedback available. Legacy attempts (predating Stage 1 of the feedback pipeline)
 *   are shown with a "Legacy" chip and no feedback action. The component subscribes
 *   to QuizFeedbackDataContext for its data and dispatches a fetch on mount via
 *   useEffect. Navigation to View ② is delegated upward via the onViewFeedback prop
 *   so that the parent controls routing strategy. Loading and error states are handled
 *   inline. The CSS is entirely class-based (quizFeedbackStyles.css); no inline style
 *   objects are used except the none needed here since no values are computed at runtime.
 */

'use client';

import React, { useEffect } from 'react';
import './quizFeedbackStyles.css';
import { useQuizFeedback } from '@/app/Library/Context/QuizFeedbackDataContext';
import type { StudentAttemptSummary } from'@/app/src/quizFeedback/quizFeedback.types';
import { RefreshCw, Lock } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// [Section 1] Types
// ─────────────────────────────────────────────────────────────────────────────

interface StudentGradeListProps {
  /** The workspace document ID used to scope all Firestore queries. */
  docId: string;
  /**
   * Called when the scholar clicks "View Feedback →" on a row.
   * The parent is responsible for navigating to the StudentQuizDetail view
   * and passing the selected attemptId down.
   */
  onViewFeedback: (attemptId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 2] Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GradeChip
 * @description
 *   Renders a colour-coded tag for a given scorePct value. Green ≥ 85,
 *   Blue ≥ 70, Amber ≥ 55, Red below 55. Null scorePct renders a "Legacy" tan chip.
 */
function GradeChip({ scorePct }: { scorePct: number | null }) {
  // Step 1: Null grade means a legacy attempt with no score recorded.
  if (scorePct === null) {
    return <span className="qf-tag qf-tag--tan">Legacy</span>;
  }
  // Step 2: Map score range to a colour variant.
  const variant =
    scorePct >= 85 ? 'green' :
    scorePct >= 70 ? 'blue'  :
    scorePct >= 55 ? 'amber' : 'red';

  return (
    <span className={`qf-tag qf-tag--${variant}`}>{scorePct}%</span>
  );
}

/**
 * TableHeader
 * @description
 *   Renders the fixed header row of the grade table with column labels.
 *   Purely presentational; receives no props.
 */
function TableHeader() {
  const columns = ['Lesson', 'Quiz', 'Date', 'Grade', 'Feedback'];
  return (
    <div className="qf-grade-table-grid qf-grade-table-header">
      {columns.map(col => (
        <span key={col} className="qf-grade-table-col-label">{col}</span>
      ))}
    </div>
  );
}

/**
 * TableRow
 * @description
 *   Renders a single attempt row. The feedback cell conditionally renders either
 *   the "View Feedback →" ghost button (when hasFeedback is true) or the
 *   "Not available" plain text for legacy attempts.
 */
function TableRow({
  attempt,
  onViewFeedback,
}: {
  attempt: StudentAttemptSummary;
  onViewFeedback: (attemptId: string) => void;
}) {
  // Step 1: Format the ISO submittedAt timestamp to a short display date.
  const displayDate = new Date(attempt.submittedAt).toLocaleDateString('en-US', {
    month: 'short',
    day:   '2-digit',
  });


  /**
   * isFeedbackLocked
   * @description
   * Evaluates the educator's timing policy. If the quiz is set to 'after_close', it checks 
   * if the current system time is before the end date. Returns true if restricted.
   */
  const isLocked = attempt.feedbackSetting === 'after_close' && 
                   attempt.quizEndAt && 
                   new Date().getTime() < new Date(attempt.quizEndAt).getTime();

  return (
    <div className="qf-grade-table-grid qf-grade-table-row">
      {/* Step 2: Lesson cell */}
      <span className="qf-grade-cell--lesson">{attempt.lessonTitle}</span>

      {/* Step 3: Quiz title cell with feedback star indicator */}
      <span className="qf-grade-cell--quiz">
        {attempt.quizTitle}
        {attempt.hasFeedback && (
          <span className="qf-feedback-star" aria-label="Feedback available">✦</span>
        )}
      </span>

      {/* Step 4: Date cell */}
      <span className="qf-grade-cell--date">{displayDate}</span>

      {/* Step 5: Grade chip */}
      <span><GradeChip scorePct={attempt.scorePct} /></span>

      {/* Step 6: Feedback action — button or legacy text */}
      <span>
        {attempt.hasFeedback ? (
          isLocked ? (
            <div className="qf-locked-feedback">
              <Lock size={12} />
              <span>Available {new Date(attempt.quizEndAt!).toLocaleDateString()}</span>
            </div>
          ) : (
            <button className="qf-btn qf-btn--ghost qf-btn--small" onClick={() => onViewFeedback(attempt.attemptId)}>
              View Feedback →
            </button>
          )
        ) : (
          <span className="qf-grade-cell--legacy-text">Not available</span>
        )}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 3] Main component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * StudentGradeList
 * @description
 *   Top-level component for View ①. Fetches the student's attempt summaries from
 *   the context on mount. Renders a table of attempts with grade chips and feedback
 *   action buttons. Delegates navigation to View ② via the onViewFeedback prop.
 */
export default function StudentGradeList({ docId, onViewFeedback }: StudentGradeListProps) {
  const {
    studentAttempts,
    fetchStudentAttempts,
    isLoading,
    error,
  } = useQuizFeedback();


  // Step 2: Render loading state while the BFF request is in flight.
  if (isLoading) {
    return (
      <div className="qf-state-wrapper">
        <div className="qf-spinner" aria-label="Loading grades" />
        <span>Loading your grades…</span>
      </div>
    );
  }

  // Step 3: Render error state if the BFF returned an error.
  if (error) {
    return (
      <div>
        <div className="qf-error-banner" role="alert">
          Could not load grades: {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }} className="quiz-scrollbar">
      {/* Step 4: View header */}
      <div className="qf-view-header">
       </div>

      {/* Step 5: Grade table card */}
      <div className="qf-card qf-card--no-pad">
        <TableHeader />

        {/* Step 6: Empty state when no attempts exist yet */}
        {studentAttempts.length === 0 ? (
          <div className="qf-state-wrapper">
            <span>No submitted quiz attempts yet.</span>
          </div>
        ) : (
          studentAttempts.map(attempt => (
            <TableRow
              key={attempt.attemptId}
              attempt={attempt}
              onViewFeedback={onViewFeedback}
            />
          ))
        )}
      </div>
    </div>
  );
}
