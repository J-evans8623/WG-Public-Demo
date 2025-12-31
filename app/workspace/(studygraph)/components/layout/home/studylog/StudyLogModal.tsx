// StudyLogModal.tsx

/***************************************************************************************
 * @file StudyLogModal.tsx
 * @description
 * StudyLogModal is the detailed view overlay for the Study Log feature.
 *
 * Phase 3 Update:
 * - Removed "Weekly Trend" chart (data model no longer supports daily breakdown).
 * - Removed "Custom" tab and date range pickers (simplification).
 * - Refactored the list view to be a "Distribution Leaderboard". It now accepts
 * a `notebookStats` map and renders notebooks ranked by duration for the
 * selected period (Week vs All Time).
 ***************************************************************************************/

import React, { useEffect, useMemo, useState } from 'react';
import { X, Clock, Calendar, TrendingUp, Book } from 'lucide-react';
import './StudyLog.css';
import { NotebookStudyStats } from '@/app/Library/Definitions/StudyLogDefinitions';

export type StudyLogModalProps = {
  isOpen: boolean;
  onClose: () => void;

  /**
   * The aggregated stats for the current period context.
   * passed from parent (Homescreen) which calculates these from context data.
   */
  totalHours: number;
  totalSessions: number;
  
  /**
   * The raw stats map from the StudyLogContext.
   * Used to generate the ranked list of notebooks.
   */
  notebookStats: Record<string, NotebookStudyStats>;
  
  /**
   * Helper to look up notebook names by ID.
   * (Homescreen usually has access to the file list).
   */
  getNotebookName: (id: string) => string;

  initialTab?: 'week' | 'alltime';
  titleLabel?: string;
};

/**
 * @function StudyLogModal
 * @description
 * Renders the detailed Study Log modal overlay.
 * Displays high-level stats (Hours/Sessions) and a ranked list of notebooks
 * based on the selected time period (Week vs All Time).
 */
const StudyLogModal: React.FC<StudyLogModalProps> = ({
  isOpen,
  onClose,
  totalHours,
  totalSessions,
  notebookStats,
  getNotebookName,
  initialTab = 'week',
  titleLabel = 'Study Summary',
}) => {
  const [activeTab, setActiveTab] = useState<'week' | 'alltime'>(initialTab);

  // Step 1: Reset tab when opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Step 2: Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Step 3: Compute the "Leaderboard" list
  // We transform the map into an array, filter out 0-duration entries for the active period,
  // and sort by duration descending.
  const rankedNotebooks = useMemo(() => {
    const entries = Object.entries(notebookStats || {});

    const mapped = entries.map(([id, stats]) => {
      const seconds = activeTab === 'week' ? stats.weekly : stats.total;
      return {
        id,
        seconds,
        name: getNotebookName(id) || 'Unknown Notebook'
      };
    });

    // Filter out notebooks with 0 time for this period and sort
    return mapped
      .filter(item => item.seconds > 0)
      .sort((a, b) => b.seconds - a.seconds);
  }, [notebookStats, activeTab, getNotebookName]);

  // Step 4: Format duration helper (e.g., "1h 30m" or "45m")
  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (!isOpen) return null;

  return (
    <div
      className="studylog-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Study summary modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="studylog-modal">
        {/* Header */}
        <div className="studylog-modal__header">
          <div>
            <h2 className="studylog-modal__title">{titleLabel}</h2>
          </div>

          <button
            type="button"
            className="studylog-modal__closeBtn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Controls: Tab Switcher (Simplified) */}
        <div className="studylog-modal__controls">
          <div className="studylog-modal__segmented" role="tablist" aria-label="Period selection">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'week'}
              className={`studylog-modal__segBtn ${activeTab === 'week' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('week')}
            >
              This Week
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'alltime'}
              className={`studylog-modal__segBtn ${activeTab === 'alltime' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('alltime')}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="studylog-modal__body">
          {/* Stats Grid: Always shows the totals passed in via props (which should match the active tab context) */}
          <div className="studylog-modal__statsGrid" aria-label="Summary statistics">
            <div className="studylog-stat">
              <div className="studylog-stat__label">
                <Clock size={14} />
                <span>Total Time</span>
              </div>
              <div className="studylog-stat__value">
                {/* Check for NaN/Infinity safety if calculation is pending */}
                {isFinite(totalHours) ? totalHours.toFixed(1) : '0.0'}h
              </div>
            </div>

            <div className="studylog-stat">
              <div className="studylog-stat__label">
                <Calendar size={14} />
                <span>Sessions</span>
              </div>
              <div className="studylog-stat__value">{totalSessions}</div>
            </div>

            {/* Daily Average only relevant for 'Week' view */}
            {activeTab === 'week' && (
               <div className="studylog-stat">
               <div className="studylog-stat__label is-blue">
                 <TrendingUp size={14} />
                 <span>Daily Avg</span>
               </div>
               <div className="studylog-stat__value">
                 {(totalHours / 7).toFixed(1)}h
               </div>
             </div>
            )}
          </div>

          {/* Distribution List (Replaces Chart & History) */}
          <div className="studylog-panel">
            <div className="studylog-panel__top">
              <h3 className="studylog-panel__title">
                {activeTab === 'week' ? 'Weekly Breakdown' : 'All-Time Distribution'}
              </h3>
            </div>

            <div className="studylog-sessions" aria-label="Notebook distribution list">
              {rankedNotebooks.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No activity recorded for this period.
                </div>
              ) : (
                rankedNotebooks.map((item, i) => (
                  <div
                    key={item.id}
                    className="studylog-sessionRow"
                    style={{ cursor: 'default' }} // Not clickable yet
                  >
                    <div className="studylog-sessionRow__left" style={{ gridTemplateColumns: '1fr auto' }}>
                      {/* Name & Rank */}
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className="text-xs font-bold text-gray-400 w-4 text-right">{i + 1}</span>
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Book size={14} className="text-gray-400 flex-shrink-0" />
                          <span className="studylog-sessionRow__nb truncate" title={item.name}>
                            {item.name}
                          </span>
                        </div>
                      </div>
                      
                      {/* Duration */}
                      <span className="studylog-sessionRow__dur">
                        {formatDuration(item.seconds)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="studylog-modal__footer">
          <button type="button" className="studylog-modal__doneBtn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudyLogModal;