/***************************************************************************************
 * @file StudyLogCard.tsx
 * @description
 *   StudyLogCard is the compact, summarized “Study Log” widget designed to live inside
 *   the Homescreen right sidebar. Its responsibility is to provide a fast weekly glance
 *   at the user’s study behavior without requiring navigation away from the dashboard.
 *   The card surfaces two primary metrics (hours and sessions) along with a subtle goal
 *   progress indicator and a single, clear CTA that opens the detailed modal view.
 *
 *   This file intentionally keeps UI concerns separated from persistence concerns: the
 *   component accepts ready-to-render values via props. The card is styled to match the
 *   HomeScreen design system (white surface, soft shadow, rounded corners, warm tan
 *   borders) and uses consistent brand accents (sage and blue).
 *
 *   NOTE ON GOAL:
 *   - The progress bar now tracks WEEKLY SESSIONS (more meaningful for WiseGraph).
 *   - For backwards-compatibility, the existing prop name `weeklyGoalHours` is retained,
 *     but it is now interpreted as `weeklyGoalSessions` at the UI level.
 ***************************************************************************************/

import React from 'react';
import { ChevronRight } from 'lucide-react';
import './StudyLog.css';

export type StudyLogCardProps = {
  weeklyHours: number;
  weeklySessions: number;

  /**
   * Backwards-compatible prop name.
   * Interpreted as: weeklyGoalSessions (count of sessions) for the progress bar.
   */
  weeklyGoalHours: number;

  onOpenDetails: () => void;

  /**
   * Deprecated: retained for callsite compatibility, but no longer rendered.
   * (We removed the "View all-time" UI per requirements.)
   */
  onOpenAllTime?: () => void;

  badgeLabel?: string;

  /**
   * Optional override for the visible title label (lets you rename later without refactors).
   */
  titleLabel?: string;
};

/**
 * @function StudyLogCard
 * @description
 *   Renders the summarized Study Log card used on the Homescreen sidebar. The component
 *   focuses on quick comprehension: it shows weekly hours, weekly sessions, and a compact
 *   progress bar against a weekly sessions goal. The card exposes a single CTA that opens
 *   the detailed modal view and intentionally avoids secondary actions that add noise.
 */
const StudyLogCard: React.FC<StudyLogCardProps> = ({
  weeklyHours,
  weeklySessions,
  weeklyGoalHours,
  onOpenDetails,
  badgeLabel = 'This week',
  titleLabel = 'Study Log',
}) => {
  // Step 1: Weekly goal now represents sessions (not hours). Clamp safely to 0–100%.
  const weeklyGoalSessions = weeklyGoalHours;
  const progressPctRaw =
    weeklyGoalSessions > 0 ? (weeklySessions / weeklyGoalSessions) * 100 : 0;
  const progressPct = Math.max(0, Math.min(100, progressPctRaw));

  return (
    <div className="assistant-card studylog-card" aria-label="Study Log summary card">
      {/* Step 2: Header row with title and small period badge. */}
      <div className="studylog-card__header">
        <h3 className="studylog-card__title">{titleLabel}</h3>
        <span className="studylog-card__badge">{badgeLabel}</span>
      </div>

      {/* Step 3: Primary metrics with tan divider between columns. */}
      <div className="studylog-card__metrics" aria-label="Weekly study summary metrics">
        <div className="studylog-card__metric">
          <div className="studylog-card__metricValue">{weeklyHours}h</div>
          <div className="studylog-card__metricLabel">Hours this week</div>
        </div>

        <div className="studylog-card__metricDivider" aria-hidden="true" />

        <div className="studylog-card__metric">
          <div className="studylog-card__metricValue">{weeklySessions}</div>
          <div className="studylog-card__metricLabel">Sessions completed</div>
        </div>
      </div>

      {/* Step 4: Weekly goal progress indicator (sessions-based). */}
      <div className="studylog-card__progress" aria-label="Weekly sessions goal progress">
        <div className="studylog-card__progressTop">
          <span>Weekly goal</span>
          <span className="studylog-card__progressValue">
            {weeklySessions} / {weeklyGoalSessions} sessions
          </span>
        </div>

        <div className="studylog-card__progressTrack" aria-hidden="true">
          <div
            className="studylog-card__progressFill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Step 5: Single action only (open details). */}
      <div className="studylog-card__footer">
        <button
          type="button"
          onClick={onOpenDetails}
          className="studylog-card__linkBtn"
        >
          Show more <ChevronRight className="studylog-card__chev" />
        </button>
      </div>
    </div>
  );
};

export default StudyLogCard;
