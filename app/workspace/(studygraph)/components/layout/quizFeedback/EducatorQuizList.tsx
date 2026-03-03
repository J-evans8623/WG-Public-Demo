/**
 * @file app/workspace/(studygraph)/components/quizFeedback/EducatorQuizList.tsx
 * @description
 *   View ③ in the QuizFeedback feature. Renders a card grid giving educators an
 *   at-a-glance overview of every assigned quiz in the current workspace document.
 *   Each card shows the quiz title, the lesson it belongs to, the number of
 *   feedback-enabled student submissions, the average grade across those submissions,
 *   and the open/close date window. Clicking any card navigates the educator to the
 *   Histogram view (View ④) for that quiz. Quizzes that have received zero
 *   feedback-enabled submissions are shown with "0 students" and "–%" to keep the
 *   grid complete and immediately indicate that no aggregated data exists yet. The
 *   grade badge on each card uses a dynamic accent colour computed from the avgGrade
 *   value; this is the only case in the component where an inline style is used, as the
 *   colour is a runtime-computed value that CSS classes cannot express. All other
 *   styling comes exclusively from quizFeedbackStyles.css.
 */

'use client';

import React  from 'react';
import './quizFeedbackStyles.css';
import { useQuizFeedback } from '@/app/Library/Context/QuizFeedbackDataContext';
import type { QuizInsightSummary } from'@/app/src/quizFeedback/quizFeedback.types';
import { ArrowLeft, RefreshCw } from 'lucide-react';


// ─────────────────────────────────────────────────────────────────────────────
// [Section 1] Types
// ─────────────────────────────────────────────────────────────────────────────

interface EducatorQuizListProps {
  /** The workspace document ID used to scope all Firestore queries. */
  docId: string;
  /**
   * Called when the educator clicks an insight card.
   * The parent is responsible for navigating to the EducatorHistogram view
   * and passing the selected assignmentId down.
   */
  onViewHistogram: (assignmentId: string) => void;
  onBackToGrid: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 2] Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getGradeAccentColor
 * @description
 *   Returns the CSS colour value used for the dynamic grade badge accent on each
 *   insight card. The colour is a runtime value derived from the avgGrade number,
 *   so it must be applied via inline style rather than a static CSS class.
 *   Green ≥ 85, Blue ≥ 70, Amber below 70.
 */
function getGradeAccentColor(avgGrade: number): string {
  if (avgGrade >= 85) return 'var(--qf-green)';
  if (avgGrade >= 70) return 'var(--qf-blue)';
  return 'var(--qf-amber)';
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 3] Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * InsightCard
 * @description
 *   Renders a single quiz insight card. The grade badge accent colour is the only
 *   inline style used — background-color and color are both derived from avgGrade
 *   at render time. All other styling uses CSS classes from quizFeedbackStyles.css.
 */
function InsightCard({
  quiz,
  onViewHistogram,
}: {
  quiz: QuizInsightSummary;
  onViewHistogram: (assignmentId: string) => void;
}) {
  // Step 1: Compute the accent colour for the grade badge from the avgGrade value.
  const accentColor = getGradeAccentColor(quiz.avgGrade);

  // Step 2: Build the inline style for the dynamic grade badge.
  //         background uses 20% opacity via hex suffix; border and text use full colour.
  const badgeStyle: React.CSSProperties = {
    backgroundColor: `${accentColor.replace('var(', '').replace(')', '')}20`,
    border:          `1.5px solid ${accentColor}`,
    color:           accentColor,
  };

  // Step 3: Because CSS variables can't be used directly in the hex-opacity trick above,
  //         we resolve the actual hex values here instead.
  const gradeHex =
    quiz.avgGrade >= 85 ? '#5B8C5A' :
    quiz.avgGrade >= 70 ? '#6C8EBF' : '#D4860A';

  const resolvedBadgeStyle: React.CSSProperties = {
    backgroundColor: `${gradeHex}20`,
    border:          `1.5px solid ${gradeHex}`,
    color:           gradeHex,
  };

  return (
    <div
      className="qf-card qf-insight-card"
      onClick={() => onViewHistogram(quiz.assignmentId)}
      role="button"
      tabIndex={0}
      aria-label={`View performance insights for ${quiz.quizTitle}`}
      onKeyDown={e => {
        // Step 4: Keyboard accessibility — trigger on Enter or Space.
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewHistogram(quiz.assignmentId);
        }
      }}
    >
      {/* Step 5: Card header — title, lesson, dynamic grade badge */}
      <div className="qf-insight-card__header">
        <div>
          <p className="qf-insight-card__title">{quiz.quizTitle}</p>
          <p className="qf-insight-card__subtitle">{quiz.lessonTitle}</p>
        </div>
        {/* Step 6: Dynamic grade badge using inline style for computed colour */}
        <div
          className="qf-insight-card__grade-badge"
          style={resolvedBadgeStyle}
        >
          {quiz.attemptCount > 0 ? `${quiz.avgGrade}%` : '—'}
        </div>
      </div>

      {/* Step 7: Stats row — attempt count and date window */}
      <div className="qf-insight-card__stats">
        <div>
          <p className="qf-insight-card__stat-label">Attempts</p>
          <p className="qf-insight-card__stat-value--large">{quiz.attemptCount}</p>
        </div>
        <div>
          <p className="qf-insight-card__stat-label">Window</p>
          <p className="qf-insight-card__stat-value--small">{quiz.dateWindow}</p>
        </div>
      </div>

      {/* Step 8: Right-aligned CTA label */}
      <div className="qf-insight-card__cta">View Insights →</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 4] Main component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EducatorQuizList
 * @description
 *   Top-level component for View ③. Fetches quiz insight summaries from the context
 *   on mount. Renders a responsive card grid. Delegates navigation to the histogram
 *   view via the onViewHistogram prop.
 */
export default function EducatorQuizList({ docId, onViewHistogram, onBackToGrid }: EducatorQuizListProps) {
  const {
    quizInsights,
    fetchQuizInsights,
    isLoading,
    error,
  } = useQuizFeedback();

 
  // Step 2: Loading state.
  if (isLoading) {
    return (
      <div className="qf-state-wrapper">
        <div className="qf-spinner" aria-label="Loading quiz insights" />
        <span>Loading quiz insights…</span>
      </div>
    );
  }

  // Step 3: Error state.
  if (error) {
    return (
      <div>
        <div className="qf-error-banner" role="alert">
          Could not load quiz insights: {error}
        </div>
      </div>
    );
  }

 return (
    /* UPDATE - 2.5: Wrapped in scrollable div to manage large quiz counts */
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }} className="quiz-scrollbar">
      
      {/* UPDATE - 2.6: Added semantic navigation trigger to get back to the Gradebook Grid */}
      <div className="qf-back-row" style={{ marginBottom: '12px' }}>
        <button className="qf-back-btn" onClick={onBackToGrid} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ArrowLeft size={16} />
          Back to Gradebook
        </button>
      </div>

      <div className="qf-view-header">
        {/* UPDATE - 2.7: Semantic Label improvement */}
        <h2 className="qf-view-title">Performance Insights</h2>
        <p className="qf-view-subtitle">
          Analyze topic-level struggles and class averages across your assessments.
        </p>
      </div>

      {quizInsights.length === 0 ? (
        <div className="qf-state-wrapper">
          <span>No assigned quizzes found for this document.</span>
        </div>
      ) : (
        <div className="qf-insight-grid" style={{ paddingBottom: '20px' }}>
          {quizInsights.map(quiz => (
            <InsightCard
              key={quiz.assignmentId}
              quiz={quiz}
              onViewHistogram={onViewHistogram}
            />
          ))}
        </div>
      )}
    </div>
  );
}