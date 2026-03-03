/**
 * @file app/workspace/(studygraph)/components/quizFeedback/EducatorHistogram.tsx
 * @description
 *   View ④ in the QuizFeedback feature. Renders the pre-aggregated topic performance
 *   histogram for a specific assigned quiz. Topics are displayed as horizontal bars
 *   sorted descending by incorrect answer count (highest struggle first), colour-coded
 *   red (≥ 60% error rate), amber (≥ 35%), or green (below 35%). Each bar shows the
 *   percentage label inline when there is enough space (> 20% width). Below the chart,
 *   an auto-generated insight callout highlights the top-struggle topic derived from
 *   quizHistogram.topics[0] — the array is pre-sorted by the ConsumerAdapter.
 *
 *   Bar width percentage and bar fill colour are the only inline styles in this component;
 *   both are runtime-computed values that cannot be expressed as static CSS classes. All
 *   other layout, typography, and spacing rules come from quizFeedbackStyles.css.
 *
 *   Unmount behaviour (Sprint 3 latency fix):
 *   The previous implementation called clearHistogram() in a useEffect cleanup function.
 *   That was the direct cause of the histogram re-fetch loop: clearing the data on unmount
 *   nullified the context cache, so navigating back and reopening the same histogram
 *   triggered another BFF round-trip. The cleanup call has been removed. clearHistogram
 *   now only runs when GradebookModal fully closes. The fetchQuizHistogram call in
 *   QuizFeedbackDataContext is cached by assignmentId, so reopening the same histogram
 *   within a session is instant.
 */

'use client';

import React, { useEffect } from 'react';
import './quizFeedbackStyles.css';
import { useQuizFeedback } from '@/app/Library/Context/QuizFeedbackDataContext';
import type { TopicBreakdown } from '@/app/src/quizFeedback/quizFeedback.types';
import { useNodesContext } from '@/app/Library/Context/NodesProvider';

// ─────────────────────────────────────────────────────────────────────────────
// [Section 1] Types
// ─────────────────────────────────────────────────────────────────────────────

interface EducatorHistogramProps {
  /** The workspace document ID used to scope all Firestore queries. */
  docId:         string;
  /** The assigned quiz to display the histogram for. */
  assignmentId:  string;
  /** Called when the educator clicks "← All Quizzes". Parent controls navigation. */
  onBack:        () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 2] Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getBarColor
 * @description
 *   Returns the hex colour for a histogram bar based on the topic's error rate
 *   (incorrectCount / totalAttempts). Red for ≥ 60%, Amber for ≥ 35%, Green below.
 *   This is a runtime-computed value passed as an inline style on the bar element.
 */
function getBarColor(incorrectCount: number, totalAttempts: number): string {
  if (totalAttempts === 0) return '#D4C4B0'; // fallback tan for zero-data edge case
  const rate = incorrectCount / totalAttempts;
  if (rate >= 0.6) return '#C0392B'; // var(--qf-red)
  if (rate >= 0.35) return '#D4860A'; // var(--qf-amber)
  return '#5B8C5A';                   // var(--qf-green)
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 3] Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * HistogramBar
 * @description
 *   Renders a single topic row: label + count label above, and the bar track + fill below.
 *   Bar width and fill color are the only values applied via inline style because they
 *   depend on computed percentages. Everything else uses CSS classes from quizFeedbackStyles.css.
 */
function HistogramBar({
  topic,
  maxIncorrect,
}: {
  topic:        TopicBreakdown;
  maxIncorrect: number;
}) {
  // Step 1: Compute bar width as a percentage of the maximum incorrect count.
  const widthPct = maxIncorrect > 0
    ? (topic.incorrectCount / maxIncorrect) * 100
    : 0;

  // Step 2: Compute the display percentage relative to totalAttempts for the inline label.
  const displayPct = topic.totalAttempts > 0
    ? Math.round((topic.incorrectCount / topic.totalAttempts) * 100)
    : 0;

  // Step 3: Derive bar fill colour from the error rate.
  const barColor = getBarColor(topic.incorrectCount, topic.totalAttempts);

   const {getNodeTitle} = useNodesContext();
    const TopicTitle = getNodeTitle(topic.topicId);

  return (
    <div className="qf-histogram-topic">
      {/* Step 4: Row label — topic name on the left, count fraction on the right */}
      <div className="qf-histogram-topic__row">
        <span className="qf-histogram-topic__label">{ TopicTitle}</span>
        <span className="qf-histogram-topic__count">
          <strong style={{ color: barColor }}>{topic.incorrectCount}</strong>
          {' / '}{topic.totalAttempts} incorrect
        </span>
      </div>

      {/* Step 5: Bar track and animated fill */}
      <div className="qf-histogram-track">
        <div
          className="qf-histogram-bar"
          style={{
            width:           `${widthPct}%`,
            backgroundColor: barColor,
          }}
          role="progressbar"
          aria-valuenow={topic.incorrectCount}
          aria-valuemin={0}
          aria-valuemax={topic.totalAttempts}
          aria-label={`${topic.topicLabel}: ${topic.incorrectCount} of ${topic.totalAttempts} incorrect`}
        >
          {/* Step 6: Inline percentage label only when bar is wide enough to hold it */}
          {widthPct > 20 && (
            <span className="qf-histogram-bar__pct">{displayPct}%</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * HistogramLegend
 * @description
 *   Renders the three-dot colour legend below the histogram bars.
 *   Colours are hardcoded to match the getBarColor thresholds.
 */
function HistogramLegend() {
  const entries: Array<{ label: string; color: string }> = [
    { label: 'High struggle', color: '#C0392B' },
    { label: 'Moderate',      color: '#D4860A' },
    { label: 'Low',           color: '#5B8C5A' },
  ];
  return (
    <div className="qf-legend">
      {entries.map(({ label, color }) => (
        <div key={label} className="qf-legend__item">
          <div
            className="qf-legend__dot"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          <span className="qf-legend__label">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 4] Main component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EducatorHistogram
 * @description
 *   Top-level component for View ④. Fetches the pre-aggregated histogram data from
 *   the context using the assignmentId prop as the key. The fetch is cached by
 *   assignmentId in the context provider — opening the same histogram a second time
 *   within a session skips the network call entirely.
 *
 *   NOTE: There is intentionally NO cleanup return calling clearHistogram on unmount.
 *   Clearing on unmount was the source of the re-fetch loop. The context cache keeps
 *   the histogram data alive across scene transitions within the same modal session.
 */
export default function EducatorHistogram({
  docId,
  assignmentId,
  onBack,
}: EducatorHistogramProps) {
  const {
    quizHistogram,
    fetchQuizHistogram,
    isLoading,
    error,
  } = useQuizFeedback();

  // Step 1: Trigger the histogram fetch when this view mounts or assignmentId changes.
  //         fetchQuizHistogram is cached by assignmentId in the context — if the educator
  //         drills into the same quiz a second time in the same session, the cache hit
  //         returns immediately with no network call.
  //
  //         NOTE: There is intentionally NO cleanup return calling clearHistogram.
  //         Clearing on unmount was the source of the re-fetch loop. The context cache
  //         keeps histogram data alive across scene transitions within the same session.
  useEffect(() => {
    fetchQuizHistogram(docId, assignmentId);
  }, [docId, assignmentId, fetchQuizHistogram]);

  // Step 2: Loading state.
  if (isLoading) {
    return (
      <div className="qf-state-wrapper">
        <div className="qf-spinner" aria-label="Loading histogram" />
        <span>Loading performance data…</span>
      </div>
    );
  }

  // Step 3: Error state — includes back button so educator is not stranded.
  if (error) {
    return (
      <div>
        <div className="qf-back-row">
          <button className="qf-back-btn" onClick={onBack}>← All Quizzes</button>
        </div>
        <div className="qf-error-banner" role="alert">
          {error === 'INSIGHTS_NOT_FOUND'
            ? 'No submissions recorded yet for this quiz. Insights will appear after students submit.'
            : `Could not load performance data: ${error}`}
        </div>
      </div>
    );
  }

  // Step 4: Guard against brief render window before first fetch resolves.
  if (!quizHistogram) return null;

  const { quizTitle, lessonTitle, attemptCount, avgGrade, topics } = quizHistogram;

  // Step 5: Derive the max incorrect count for proportional bar width calculation.
  const maxIncorrect = topics.length > 0
    ? Math.max(...topics.map(t => t.incorrectCount))
    : 0;

  // Step 6: Derive insight callout data from the highest-struggle topic (topics[0]).
  const topTopic     = topics[0] ?? null;
  const topErrorRate = topTopic && topTopic.totalAttempts > 0
    ? Math.round((topTopic.incorrectCount / topTopic.totalAttempts) * 100)
    : 0;

  // Step 7: Derive the average grade tag colour.
  const avgGradeVariant = avgGrade >= 85 ? 'green' : 'amber';

  return (
    <div 
    className="qf-main-container quiz-scrollbar"
    style={{
        flex:        '1 1 0%',
        minHeight:   0,           /* CRITICAL: mirrors the ancestor fix at leaf level */
        overflowY:   'auto',
        overflowX:   'hidden',
        paddingRight: '8px',
      }}
  >
      {/* Step 8: Back navigation */}
      <div className="qf-back-row">
        <button className="qf-back-btn" onClick={onBack}>← All Quizzes</button>
      </div>

      {/* Step 9: View header with quiz title, lesson, student count, avg grade */}
      <div className="qf-view-header--spaced">
        <div>
          <h2 className="qf-view-title">{quizTitle}</h2>
          <p className="qf-view-subtitle qf-view-subtitle--tight">{lessonTitle}</p>
        </div>
        <div className="qf-badges-row">
          <span className="qf-tag qf-tag--blue">{attemptCount} students</span>
          <span className={`qf-tag qf-tag--${avgGradeVariant}`}>Avg {avgGrade}%</span>
        </div>
      </div>

      {/* Step 10: Section label */}
      <p className="qf-section-label">Incorrect Answers by Topic</p>

      {/* Step 11: Main chart card */}
      <div className="qf-card">
        <p className="qf-histogram-description">
          Each bar shows how many students answered that topic&apos;s question(s) incorrectly.
          Higher bars = more struggle.
        </p>

        {topics.length === 0 ? (
          <div className="qf-state-wrapper">
            <span>No topic data available yet.</span>
          </div>
        ) : (
          <>
            {/* Step 12: Render all topic bars */}
            <div className="qf-histogram-bars" >
              {topics.map(topic => (
                <HistogramBar
                  key={topic.topicId}
                  topic={topic}
                  maxIncorrect={maxIncorrect}
                />
              ))}
            </div>

            {/* Step 13: Legend */}
            <HistogramLegend />
          </>
        )}
      </div>
    </div>
  );
}