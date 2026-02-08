// app/workspace/(studygraph)/components/modals/GradebookModal.tsx
/**
 * @file GradebookModal.tsx
 * @description
 *   This modal renders the gradebook grid using a single authoritative source: the server snapshot
 *   retrieved by the `useGradebook(docId)` hook ( update - 2001 ). In Phase 1 we remove all internal
 *   mock-data generation and wire the modal to the live hook. When opened, the component triggers an
 *   immediate `refresh()` to fetch students, assignments, and grades from the backend; the same
 *   `refresh()` is exposed on the “Refresh” button ( update - 2002 ). A sticky header row and a sticky
 *   first column preserve context during scroll while CSS styling remains unchanged. The grid itself
 *   is O(S×A) to render. Purposeful logs annotate open/close, refresh actions, and status changes to
 *   support debugging without noise. The modal does not coordinate with Yjs at all by design.
 */

import React, { useEffect, useState, useMemo } from 'react';
import '@/app/workspace/(studygraph)/components/modals/modalStyles.css';
import './gradebook.css';
import { useGradebook } from '@/app/Library/hooks/useGradebook'; // update - 2003

export interface GradebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Scope the gradebook to a document. */
  docId: string; // update - 2004
}

/**
 * formatWindow
 * @description
 *   Return a concise local time-window label for an assignment header to keep the table header
 *   readable. This is a pure formatter with O(1) cost and localized output via toLocaleString.
 */
function formatWindow(startAt: string, endAt: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  };
  return `${new Date(startAt).toLocaleString(undefined, opts)} – ${new Date(endAt).toLocaleString(
    undefined,
    opts
  )}`;
}

const GradebookModal: React.FC<GradebookModalProps> = ({ isOpen, onClose, docId }) => {
  const { assignments, students, grid, status, lastUpdated, error, refresh } = useGradebook(docId); // update - 2005

  //Track visibility state for deleted assignments
  const [showDeleted, setShowDeleted] = useState(false);

  // Filter assignments based on showDeleted state
  const visibleAssignments = useMemo(() => {
    if (showDeleted) return assignments;
    return assignments.filter(a => a.status !== 'deleted');
  }, [assignments, showDeleted]);


  // Check if there are any deleted items available to show
  const hasDeletedItems = assignments.some(a => a.status === 'deleted');

  // Load on open ( update - 2006 )
  useEffect(() => {
    if (!isOpen) return;
    console.log('[GradebookModal.tsx][7711] open → refresh begin', { docId });
    refresh().catch((e) => console.warn('[GradebookModal.tsx][7712] initial refresh error', e?.message));
  }, [isOpen, docId, refresh]);

  if (!isOpen) return null;

  const handleRefresh = () => {
    console.log('[GradebookModal.tsx][7713] refresh clicked');
    refresh().catch((e) => console.warn('[GradebookModal.tsx][7715] refresh error', e?.message));
  };

  const isLoading = status === 'updating' || status === 'idle';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Gradebook modal">
      <div className="modal-container gb-shell" style={{ width: '92vw', maxWidth: 1280 }}>
        {/* Header */}
        <div className="gb-header">
          <h2 className="modal-title" style={{ marginBottom: 8, textAlign: 'left', flex: 1 }}>
            Grade Book
          </h2>
          <div className="gb-header-actions">
            <div className="gb-counts">
              <span>{students.length} students</span>
              <span className="gb-dot">•</span>
              <span>{assignments.length} assignments</span>
              {lastUpdated && (
                <>
                  <span className="gb-dot">•</span>
                  <span>Updated {new Date(lastUpdated).toLocaleTimeString()}</span>
                </>
              )}
            </div>
            {/* update - 3007: Add Recover button only if deleted data exists */}
            {hasDeletedItems && (
              <button 
                className={`btn btn-primary`}
                
                onClick={() => setShowDeleted(!showDeleted)}
              >
                {showDeleted ? 'Hide Deleted' : 'Show deleted'}
              </button>
            )}

            <button className="btn btn-secondary" onClick={handleRefresh} disabled={isLoading}>
              {isLoading ? 'Loading…' : 'Refresh'}
            </button>
            <button
              className="gb-close"
              onClick={() => {
                console.log('[GradebookModal.tsx][7714] close clicked');
                onClose();
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Error banner (non-blocking) — update - 2007 */}
        {error && (
          <div className="rms-warn" role="status" aria-live="polite" style={{ margin: '8px 0' }}>
            <div className="rms-warn-left">
              <span className="rms-warn-text">{error}</span>
            </div>
          </div>
        )}

        {/* Grid body */}
        <div className="gb-body">
          <div className="gb-grid-wrapper">
            <table className="gb-table" role="table" aria-label="Gradebook">
              <thead>
                <tr>
                  <th className="gb-th gb-sticky-left gb-sticky-top" style={{ zIndex: 3 }}>
                    Name / Email
                  </th>
                  {visibleAssignments.map((a) => {
                    // update - 2009: Check status for visual styling
                    const isDeleted = a.status === 'deleted';
                    const bgStyle = isDeleted ? { backgroundColor: '#fee2e2' } : {}; // Light red header

                    return (
                        <th key={a.assignmentId} className="gb-th gb-sticky-top" style={bgStyle}>
                          <div className="gb-th-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                             {a.title}
                             {/* update - 2010: Add visual badge */}
                             {isDeleted && <span title="This Assesment was deleted." style={{ fontSize: 10, background: '#ef4444', color: 'white', padding: '1px 4px', borderRadius: 4 }}>DEL</span>}
                          </div>
                          <div className="gb-th-sub">{formatWindow(a.startAt, a.endAt)}</div>
                        </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {students.map((email, rIndex) => (
                  <tr key={email} className={rIndex % 2 === 0 ? 'gb-row-even' : 'gb-row-odd'}>
                    <td className="gb-td gb-sticky-left">
                      <div className="gb-student">
                        <div className="gb-student-name">{email.split('@')[0]}</div>
                        <div className="gb-student-email">{email}</div>
                      </div>
                    </td>
                    {visibleAssignments.map((a, cIndex) => {
                      const cell = grid[email]?.[a.assignmentId] || null;
                      const score = cell ? cell.scorePct : null;
                      const cls =
                        score === null
                          ? 'gb-score gb-score-missing'
                          : score >= 85
                          ? 'gb-score gb-score-high'
                          : score >= 70
                          ? 'gb-score gb-score-mid'
                          : 'gb-score gb-score-low';
                      return (
                        <td key={`${email}-${a.assignmentId}`} className="gb-td" data-col={cIndex + 1}>
                          <div className={cls}>{score === null ? '—' : `${score}%`}</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Empty states ( update - 2008 ) */}
            {!isLoading && visibleAssignments.length === 0 && (
              <div className="modal-subtext" style={{ marginTop: 12, textAlign: 'left' }}>
                No assignments yet. Use “Create Assigned Quiz” to add columns.
              </div>
            )}
            {!isLoading && students.length === 0 && (
              <div className="modal-subtext" style={{ marginTop: 4, textAlign: 'left' }}>
                No students found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GradebookModal;
