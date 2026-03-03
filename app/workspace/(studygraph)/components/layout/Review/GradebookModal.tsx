/**
 * @file app/workspace/(studygraph)/components/modals/GradebookModal.tsx
 * @description
 *   GradebookModal is the educator-facing grades modal rendered by GradesOrchestrator.
 *   Its responsibility is scoped exclusively to educator data — this component has no
 *   awareness of scholar account types and renders nothing for them. GradesOrchestrator
 *   guarantees that only educator account types ever receive this component.
 *
 *   Sprint 3 – Gap 3 update: a two-tab layout has been added to the modal header. The
 *   pre-existing "Gradebook" tab retains 100% of its original behaviour — the O(S×A)
 *   student × assignment grid, the refresh mechanism, the show/hide deleted toggle, the
 *   sticky header and first column, and the non-blocking error banner are all unchanged.
 *   A new "Quiz Insights" tab has been added alongside it. Within that tab the educator
 *   navigates between two scenes: EducatorQuizList (View ③), which lists all assigned
 *   quizzes with their aggregate stats, and EducatorHistogram (View ④), which drills into
 *   the topic-level error breakdown for a selected quiz. Scene state and the selected
 *   assignmentId are managed via local useState so neither child component owns routing.
 *   The QuizFeedbackProvider is mounted inside the isOpen guard so it only lives (and
 *   issues network calls) while the modal is visible. Tab state and scene state both
 *   reset when the modal closes. Two CSS utility classes — gb-tab, gb-tab--active, and
 *   gb-insights-panel — are the only new additions required in gradebook.css.
 */

import React, { useEffect, useState, useMemo } from 'react';
import '@/app/workspace/(studygraph)/components/modals/modalStyles.css';
import './gradebook.css';
import { useGradebook } from '@/app/Library/hooks/useGradebook';
//import { QuizFeedbackProvider } from '@/app/Library/Context/QuizFeedbackDataContext';
import EducatorQuizList from '@/app/workspace/(studygraph)/components/layout/quizFeedback/EducatorQuizList';
import EducatorHistogram from '@/app/workspace/(studygraph)/components/layout/quizFeedback/EducatorHistogram';
import { RefreshCw } from 'lucide-react';
import { useQuizFeedback } from '@/app/Library/Context/QuizFeedbackDataContext';

// ─────────────────────────────────────────────────────────────────────────────
// [Section 1] Types
// ─────────────────────────────────────────────────────────────────────────────

export interface GradebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Scope the gradebook to a document. */
  docId: string;
}

/**
 * EducatorTab
 * @description
 *   Discriminated union for the two top-level tabs in the educator modal. 'gradebook'
 *   maps to the pre-existing student × assignment grid. 'insights' maps to the new
 *   EducatorQuizList → EducatorHistogram quiz performance pipeline.
 */
type EducatorTab = 'gradebook' | 'insights';

/**
 * InsightsScene
 * @description
 *   Discriminated union for the two scenes within the Quiz Insights tab. 'list' renders
 *   EducatorQuizList (View ③). 'histogram' renders EducatorHistogram (View ④). Navigation
 *   between scenes is managed by local state so neither child component owns routing logic.
 */
type InsightsScene = 'list' | 'histogram';

// ─────────────────────────────────────────────────────────────────────────────
// [Section 2] Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * formatWindow
 * @description
 *   Returns a concise localised time-window label for an assignment header cell.
 *   Formats both ISO timestamps using the browser locale via toLocaleString so that
 *   the assignment date range remains human-readable within the constrained table header
 *   width. Pure function with O(1) cost and no side effects.
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

// ─────────────────────────────────────────────────────────────────────────────
// [Section 3] Main component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GradebookModal
 * @description
 *   Educator-only modal that combines the original gradebook grid with the new Quiz
 *   Insights tab. All pre-existing gradebook behaviour is preserved unchanged. The new
 *   tab chrome and InsightsScene navigation state are additive — they do not touch any
 *   of the original grid rendering, refresh logic, deleted-assignment visibility, or
 *   error banner code. QuizFeedbackProvider wraps the modal body so that EducatorQuizList
 *   and EducatorHistogram can consume QuizFeedbackDataContext.
 */
const GradebookModal: React.FC<GradebookModalProps> = ({ isOpen, onClose, docId }) => {
  const { assignments, students, grid, status, lastUpdated, error, refresh } = useGradebook(docId);

  // Step 1: Track visibility of deleted assignments in the gradebook tab.
  const [showDeleted, setShowDeleted] = useState(false);

  // Step 2: Active top-level tab — 'gradebook' is the default landing tab.
  const [activeTab, setActiveTab] = useState<EducatorTab>('gradebook');

  // Step 3: Insights sub-scene state — 'list' is the default landing scene.
  const [insightsScene, setInsightsScene] = useState<InsightsScene>('list');

  // Step 4: Store the assignmentId selected when the educator clicks a quiz card.
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');

  // Step 5: Filter assignments based on the showDeleted toggle.
  const visibleAssignments = useMemo(() => {
    if (showDeleted) return assignments;
    return assignments.filter(a => a.status !== 'deleted');
  }, [assignments, showDeleted]);

  // Step 6: Derive whether any soft-deleted assignments exist to show the recovery toggle.
  const hasDeletedItems = assignments.some(a => a.status === 'deleted');

  // Step 7: Fetch gradebook data when the modal opens (original behaviour preserved).
  useEffect(() => {
    if (!isOpen) return;
    console.log('[GradebookModal.tsx][7711] open → refresh begin', { docId });
    refresh().catch((e) => console.warn('[GradebookModal.tsx][7712] initial refresh error', e?.message));
  }, [isOpen, docId, refresh]);

  // Step 8: Reset all local state when the modal closes so the next open starts fresh.
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('gradebook');
      setInsightsScene('list');
      setSelectedAssignmentId('');
      setShowDeleted(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isLoading = status === 'updating' || status === 'idle';

  // ── Event handlers ────────────────────────────────────────────────────────

  /**
   * handleRefresh
   * @description
   *   Triggers a manual gradebook refresh when the educator clicks the Refresh button.
   *   Delegates to the refresh function returned by useGradebook; original behaviour
   *   fully preserved from the pre-sprint implementation.
   */
  const handleRefresh = () => {
    console.log('[GradebookModal.tsx][7713] refresh clicked');
    refresh().catch((e) => console.warn('[GradebookModal.tsx][7715] refresh error', e?.message));
  };

  /**
   * handleViewHistogram
   * @description
   *   Called by EducatorQuizList when the educator clicks a quiz insight card. Records
   *   the selected assignmentId in local state and transitions the Insights tab to the
   *   EducatorHistogram scene. The assignmentId is forwarded to EducatorHistogram as a
   *   prop so it can fetch the correct pre-aggregated topic breakdown from the BFF.
   */
  const handleViewHistogram = (assignmentId: string) => {
    // Step 9: Store the selected assignment and advance to the histogram scene.
    setSelectedAssignmentId(assignmentId);
    setInsightsScene('histogram');
    console.log('[GradebookModal.tsx][7716] insights → histogram for assignment', assignmentId);
  };

  /**
   * handleBackToInsightsList
   * @description
   *   Called by EducatorHistogram's "← All Quizzes" button. Resets the Insights scene
   *   to the list view and clears the stored assignmentId. EducatorHistogram's own unmount
   *   effect (clearHistogram) handles purging stale context data independently.
   */
  const handleBackToInsightsList = () => {
    // Step 10: Return to quiz list and clear the stored assignment reference.
    setInsightsScene('list');
    setSelectedAssignmentId('');
    console.log('[GradebookModal.tsx][7717] insights → back to list');
  };


  /** * NEW: Minimal helper to handle Insights Refresh without prop-drilling 
 * or disturbing the main Gradebook state.
 */
const InsightsRefreshButton = ({ docId }: { docId: string }) => {
  const { fetchQuizInsights, isLoading } = useQuizFeedback();
  return (
    <button 
      className="tertiary-button-grades" 
      onClick={() => fetchQuizInsights(docId)}
      disabled={isLoading}
      style={{ marginRight: '8px' }}
    >
      <span>Refresh </span>
      <RefreshCw size={18} className={isLoading ? 'qf-spin' : ''} />
    </button>
  );
};


  return (

      <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Gradebook modal">
        <div className="modal-container gb-shell" style={{ width: '92vw', maxWidth: 1280 }}>

          {/* Step 12: Modal header — title, tab switcher, gradebook controls, close button. */}
         <div className="gb-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          
            <h2 className="modal-title" style={{ marginBottom: 8, textAlign: 'left', flex: 1 }}>
             {activeTab == 'gradebook'? 'Grade Book' : 'Quiz Performance'}
            </h2>

            <div className="gb-header-actions">

              {/* Step 13: Tab switcher rendered in the header action row. */}
              { activeTab=="gradebook" && (
                <>
                <div className="gb-tab-row" role="tablist" aria-label="Gradebook sections">
                <button
                  role="tab"
                    onClick={() => {
                    setActiveTab('insights');
                    console.log('[GradebookModal.tsx][7721] switched to Quiz Insights tab');
                  }}
                  className="tertiary-button-grades"
                >
                  View Performance
                </button>
              </div>
              </>
              )
}
              {/* Step 14: Gradebook-only controls — counts, deleted toggle, refresh.
                          These are conditionally rendered and only appear on the
                          Gradebook tab where they are relevant. */}
              {activeTab === 'gradebook' && (
                <>
                  {/* Step 15: Show/Hide deleted toggle — only visible when deleted items exist. */}
                  {hasDeletedItems && (
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowDeleted(!showDeleted)}
                    >
                      {showDeleted ? 'Hide Deleted' : 'Show deleted'}
                    </button>
                  )}

                  <button
                    className="btn btn-secondary"
                    onClick={handleRefresh}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Loading…' : 'Refresh'}
                  </button>
                </>
              )}


              {/* NEW: Insights Refresh Button — Only shown in the Insights List scene. */}
              {activeTab === 'insights' && insightsScene === 'list' && (
                <InsightsRefreshButton docId={docId} />
              )}

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

          {/* Step 16: Non-blocking error banner scoped to the Gradebook tab. */}
          {activeTab === 'gradebook' && error && (
            <div className="rms-warn" role="status" aria-live="polite" style={{ margin: '8px 0' }}>
              <div className="rms-warn-left">
                <span className="rms-warn-text">{error}</span>
              </div>
            </div>
          )}

          {/* Step 17: Tab panel content — branches on the active tab. */}
          {activeTab === 'gradebook' ? (

            /* ── Gradebook tab: original grid, zero modifications to this block. ── */
            <div className="gb-body">
              <div className="gb-grid-wrapper">
                <table className="gb-table" role="table" aria-label="Gradebook">
                  <thead>
                    <tr>
                      <th className="gb-th gb-sticky-left gb-sticky-top" style={{ zIndex: 3 }}>
                        Name / Email
                      </th>
                      {visibleAssignments.map((a) => {
                        const isDeleted = a.status === 'deleted';
                        const bgStyle = isDeleted ? { backgroundColor: '#fee2e2' } : {};
                        return (
                          <th key={a.assignmentId} className="gb-th gb-sticky-top" style={bgStyle}>
                            <div className="gb-th-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {a.title}
                              {isDeleted && (
                                <span
                                  title="This Assessment was deleted."
                                  style={{ fontSize: 10, background: '#ef4444', color: 'white', padding: '1px 4px', borderRadius: 4 }}
                                >
                                  DEL
                                </span>
                              )}
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
                          const cell  = grid[email]?.[a.assignmentId] || null;
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

                {/* Original empty states — unchanged. */}
                {!isLoading && visibleAssignments.length === 0 && (
                  <div className="modal-subtext" style={{ marginTop: 12, textAlign: 'left' }}>
                    No assignments yet. Use &quot;Create Assigned Quiz&quot; to add columns.
                  </div>
                )}
                {!isLoading && students.length === 0 && (
                  <div className="modal-subtext" style={{ marginTop: 4, textAlign: 'left' }}>
                    No students found.
                  </div>
                )}
              </div>
            </div>

          ) : (

            /* ── Quiz Insights tab: EducatorQuizList → EducatorHistogram. ── */
            <div className="gb-body">
              <div className="gb-insights-panel">
                {insightsScene === 'list' ? (
                  /*
                   * Step 18: View ③ — EducatorQuizList.
                   *   Fetches quiz insight summary cards from the BFF on mount.
                   *   onViewHistogram triggers the scene transition to the histogram
                   *   when the educator clicks a quiz card.
                   */
                  <EducatorQuizList
                    docId={docId}
                    onViewHistogram={handleViewHistogram}
                     onBackToGrid={() => setActiveTab('gradebook')}
                  />
                ) : (
                  /*
                   * Step 19: View ④ — EducatorHistogram.
                   *   assignmentId drives the BFF fetch inside the component. onBack
                   *   resets the scene to the list. The component's own unmount effect
                   *   (clearHistogram) purges stale context data independently.
                   */
                  <EducatorHistogram
                    docId={docId}
                    assignmentId={selectedAssignmentId}
                    onBack={handleBackToInsightsList}
                  />
                )}
              </div>
            </div>

          )}

        </div>
      </div>
  );
};

export default GradebookModal;