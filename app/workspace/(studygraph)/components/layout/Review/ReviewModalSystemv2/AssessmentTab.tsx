/**
 * @file AssessmentTab.tsx
 * @description
 * (update - 2.1)
 * Refactored to include a standardized functional header that prevents user deadlocks. The component
 * now renders a clear "Assessment" title accompanied by role-specific instructional sub-text: 
 * "Create or View assigned Quizzes" for Educators and "View your assigned quizzes" for Scholars.
 * A borderless "X" close button has been integrated to allow for explicit modal dismissal via 
 * the provided onClose callback. These updates ensure the standalone instructional view satisfies 
 * standard usability heuristics while maintaining strict role-gating for administrative 
 * actions (Create, Delete, View Gradebook) internally.
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import '@/app/workspace/(studygraph)/components/modals/modalStyles.css';
import '@/app/workspace/(studygraph)/components/layout/Review/ReviewModalSystem.css';
import AssignQuizModal, {
  type CreateQuizPayload,
  type LessonLite,
} from '@/app/workspace/(studygraph)/components/layout/Review/AssignQuizModal';
import { Trash2, X, Settings } from 'lucide-react'; 
import { useApiContext } from '@/app/src/context/ApiContext';
import { useResourceContext } from '@/app/Library/Context/ResourceContext'; 
import QuizOverlay from '@/app/workspace/(studygraph)/components/layout/Canvas/ReadWriteCanvas/Overlays/QuizOverlay';
import type { QuizAssessmentResource, QuizBinding } from '@/app/Library/Definitions/Definitions'; 
import '@/app/workspace/(studygraph)/components/layout/Review/AssessmentLayout.css';
import { gradebookClient } from '@/app/workspace/(studygraph)/services/gradebook/gradebookClient';
import { useAssessmentEditPrivilege } from '@/app/workspace/(studygraph)/components/layout/Canvas/ReadWriteCanvas/Overlays/quiz/quizCrudops/useAssessmentEditPrivilege';
import AssessmentSettingsForm from './AssessmentSettingsForm';

export interface AssessmentTabProps {
  onCreateAssignedQuiz?: () => void;
  onViewGradebook?: () => void;
  onClose: () => void;
  lessons?: LessonLite[];
  onCreateQuiz?: (payload: CreateQuizPayload) => void;
  /** Current document id (fileID) used for quiz generation and gradebook scoping. */
  docId: string; 
}

type RowStatus = 'upcoming' | 'open' | 'closed';

/**
 * fmt
 * @description
 * Formats an ISO date string into a human-readable local format for quiz windows. 
 */
const fmt = (d: string) =>
  new Date(d).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * statusChip
 * @description
 * Renders a color-coded status badge for a quiz row.
 */
const statusChip = (s: 'upcoming' | 'open' | 'closed') => {
  const base: React.CSSProperties = {
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    border: '1px solid',
    display: 'inline-block',
  };
  if (s === 'open') {
    return (
      <span style={{ ...base, color: '#2C3E50', borderColor: '#5B8C5A', background: '#ECF4EC' }}>
        Open
      </span>
    );
  }
  if (s === 'upcoming') {
    return (
      <span style={{ ...base, color: '#2C3E50', borderColor: '#6C8EBF', background: '#EEF3FA' }}>
        Upcoming
      </span>
    );
  }
  return (
    <span style={{ ...base, color: '#6B7280', borderColor: '#D4C4B0', background: '#F9F7F3' }}>
        Closed
    </span>
  );
};

const AssessmentTab: React.FC<AssessmentTabProps> = ({
  onCreateAssignedQuiz,
  onViewGradebook,
  onClose,
  lessons = [],
  onCreateQuiz,
  docId,
}) => {
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  type OverlayMode = 'assessment' | 'preview';
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('assessment');

  const { selectAllQuizAssessmentsGlobal, removeAssignedQuiz } = useResourceContext();

  // Internal state management for the Metadata Editor transition
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayTitle, setOverlayTitle] = useState('');
  const [overlayType, setOverlayType] = useState<any>('multipleChoice');
  const [overlayData, setOverlayData] = useState<any[]>([]);
  const [attemptId, setattemptId] = useState<string | null>(null);

  const canEdit = useAssessmentEditPrivilege(docId, true);

  const { accountStatus, isAccountLoading, startAttempt, submitAttempt } = useApiContext();
  const isEducator = accountStatus?.accountType === 'educator';

  const [attemptsFooterWarn, setAttemptsFooterWarn] = useState<string | null>(null);
  const [inFlightStartId, setInFlightStartId] = useState<string | null>(null);
  const [overlayAttemptsRemaining, setOverlayAttemptsRemaining] = useState<number>(0);

  const rows = useMemo(() => {
    const globalQuizzes = selectAllQuizAssessmentsGlobal();
    const now = Date.now();

    const mappedRows = globalQuizzes.map((c) => {
      const startMs = c.window?.startAt ? new Date(c.window.startAt).getTime() : Number.NEGATIVE_INFINITY;
      const endMs = c.window?.endAt ? new Date(c.window.endAt).getTime() : Number.POSITIVE_INFINITY;
      
      let status: RowStatus = 'upcoming';
      if (now >= startMs && now <= endMs) status = 'open';
      if (now > endMs) status = 'closed';

      return { 
        id: c.assignmentId,
        title: c.title || 'Untitled', 
        startAt: c.window?.startAt ?? '', 
        endAt: c.window?.endAt ?? '', 
        status, 
        _sortStart: startMs, 
        attemptLimit: Number.isFinite(c.attemptLimit) && (c.attemptLimit as number) > 0 
          ? (c.attemptLimit as number) 
          : 1 
      };
    });

    return mappedRows.sort((a, b) => {
      const isClosedA = a.status === 'closed';
      const isClosedB = b.status === 'closed';
      if (isClosedA !== isClosedB) return isClosedA ? 1 : -1;
      return a._sortStart - b._sortStart;
    });

  }, [selectAllQuizAssessmentsGlobal]);

  const openCreateQuiz = () => {
    if (!isEducator) return;
    onCreateAssignedQuiz?.();
    setCreateModalOpen(true);
  };

  const getInlineSpecForAssignment = useCallback(
    (assignmentId: string):
      | { title: string; quizType: string; quizContent: any[] }
      | null => {
      const card: QuizAssessmentResource | undefined = selectAllQuizAssessmentsGlobal().find(
        (c) => c.assignmentId === assignmentId
      );
      if (!card) return null;
      const binding = card.binding as QuizBinding;
      if (!binding || binding.mode !== 'inline' || !binding.spec) return null;
      return { title: card.title || 'Quiz', quizType: binding.spec.quizType as any, quizContent: binding.spec.quizContent as any[] };
    },
    [selectAllQuizAssessmentsGlobal]
  );

  const handleOpenQuiz = useCallback(
    async (assignmentId: string) => {
      if (inFlightStartId) return;
      setAttemptsFooterWarn(null);
      setInFlightStartId(assignmentId);

      try {
        const res = await startAttempt({ docId, assignmentId });
        const local = getInlineSpecForAssignment(assignmentId);

        if (!local) {
          setAttemptsFooterWarn('Unable to locate quiz content. Please try again.');
          return;
        }

        setOverlayTitle(local.title);
        setOverlayType(local.quizType);
        setOverlayData(local.quizContent);
        setOverlayAttemptsRemaining(Number(res?.remainingAttempts ?? 0));
        setOverlayMode('assessment');
        setOverlayOpen(true);
        setattemptId(res.attemptId);
      } catch (e: any) {
        setAttemptsFooterWarn(e?.message || 'Unable to start quiz. Please try again.');
      } finally {
        setInFlightStartId(null);
      }
    },
    [inFlightStartId, docId, startAttempt, getInlineSpecForAssignment]
  );

  const handleDeleteQuiz = async (e: React.MouseEvent, assignmentId: string, title: string) => {
      e.stopPropagation();
      if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

      try {
          const res = await gradebookClient.assignMetaDelete({ docId, assignmentId });
          if (res.success) {
            removeAssignedQuiz(assignmentId);
            if (selectedAssignmentId === assignmentId) setSelectedAssignmentId(null);
          }
      } catch (err: any) {
          alert('Unable to delete. You must be the Document Owner.');
      }
  };

  const submitResults = useCallback(
    async (scorePct: number, details: any[]) => {
      try {
        await submitAttempt({ docId, attemptId, scorePct, clientMeta: { clientTs: new Date().toISOString() } } as any);
      } catch (e: any) {
        console.warn('[AssessmentTab.tsx] submitAttempt failed', e?.message);
      }
    },
    [attemptId, docId, submitAttempt]
  );

  const handleCreateQuizSubmit = (payload: CreateQuizPayload) => {
    onCreateQuiz?.(payload);
    setCreateModalOpen(false);
  };


  /**
   * handleInitiateEdit
   * @description
   * Captures the unique identifier of the assessment the educator intends to modify. 
   * This function provides a clean, primitive-based entry point for the metadata 
   * editor without requiring knowledge of the backend's AssignmentHeader interface. 
   * It handles event propagation and logs telemetry code [6803] for audit purposes.
   * UPDATE - 8.4
   */
  const handleInitiateEdit = (e: React.MouseEvent, assignmentId: string) => {
    // 1. Prevent the parent row's onClick (selection) from firing when clicking settings icon.
    e.stopPropagation(); 
    // 2. Emit audit code for management interface access frequency.
    console.log('[6803] Educator accessed internal metadata editor for:', assignmentId);
    // 3. Set the target for hydration and toggle internal visibility.
    setEditTargetId(assignmentId);
    setSettingsOpen(true);
  };

  const handleCreateQuizClose = () => setCreateModalOpen(false);

  const renderMaxAttemptsChip = (limit: number) => {
    const chipStyle: React.CSSProperties = {
      display: 'inline-block',
      border: '1px solid #E5E7EB',
      background: '#FFFFFF',
      color: '#374151',
      borderRadius: 999,
      padding: '2px 8px',
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: 'nowrap',
    };
    return <span style={chipStyle}>Max attempts: {limit}</span>;
  };

  const selectedRow = useMemo(
    () => rows.find(r => r.id === selectedAssignmentId) ?? null,
    [rows, selectedAssignmentId]
  );

  const editTargetData = useMemo(() => 
    rows.find(r => r.id === editTargetId) || null, 
    [rows, editTargetId]
  );

  const handlePreviewSelected = useCallback(() => {
    if (!selectedAssignmentId) return;
    const local = getInlineSpecForAssignment(selectedAssignmentId);
    if (!local) {
      setAttemptsFooterWarn('Unable to preview: quiz content not found.');
      return;
    }
    setOverlayTitle(local.title);
    setOverlayType(local.quizType);
    setOverlayData(local.quizContent);
    setOverlayMode('preview');
    setOverlayOpen(true);
  }, [selectedAssignmentId, getInlineSpecForAssignment]);

  useEffect(() => {
    if (!selectedAssignmentId) return;
    const el = document.querySelector(`[data-assignment-id="${selectedAssignmentId}"]`) as HTMLElement | null;
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); // update - 3.2: Improved scroll alignment
  }, [selectedAssignmentId, rows]);

  // update - 3.3: Inlined styles for the scroll container to ensure immediate fix
  const scrollAreaStyle: React.CSSProperties = {
    flex: '1 1 auto',
    overflowY: 'auto',
    marginTop: '16px',
    paddingRight: '4px',
    maxHeight: 'calc(80vh - 200px)', // adjust based on header/footer height
  };

  return (
    // update - 3.4: Enforced flex container for the whole layout
    <div className="assessment-layout" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="rms-header" style={{ marginBottom: 12, flex: '0 0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h2 className="modal-title" style={{ margin: 0, textAlign: 'left' }}>Assessment</h2>
          <span className="modal-subtext" style={{ margin: 0, textAlign: 'left' }}>
            {isEducator ? "Create or View assigned Quizzes" : "View your assigned quizzes."}
          </span>
        </div>
        <button className="rms-close" onClick={onClose} aria-label="Close" title="Close">
          <X size={20} />
        </button>
      </div>

      {isEducator && (
        <div className="button-section" style={{ justifyContent: 'flex-start', gap: 16, marginTop: 16, flex: '0 0 auto' }}>
          <button className="btn btn-primary" onClick={openCreateQuiz}>
            Create Assigned Quiz
          </button>
          <button className="btn btn-secondary" onClick={onViewGradebook}>
            View Grade Book
          </button>
        </div>
      )}

      {/* update - 3.5: Wrapped the list in the new scrollable area */}
      <div style={scrollAreaStyle}>
        {rows.length === 0 ? (
          <div className="modal-subtext" style={{ textAlign: 'left' }}>No assigned quizzes yet.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {rows.map((q) => (
              <li
                key={q.id}
                data-assignment-id={q.id}
                className="radio-option"
                role="button"
                tabIndex={0}
                onClick={() => setSelectedAssignmentId(q.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginBottom: 12,
                  padding: 14,
                  cursor: inFlightStartId ? 'wait' : 'pointer',
                  opacity: inFlightStartId && inFlightStartId === q.id ? 0.7 : 1,
                  outline: selectedAssignmentId === q.id ? '2px solid rgba(91,140,90,0.35)' : 'none',
                  borderRadius: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span className="radio-label">{q.title}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {renderMaxAttemptsChip(q.attemptLimit)}
                    {statusChip(q.status)}

                    {canEdit &&  (
                      <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                        <button 
                          onClick={(e) => handleInitiateEdit(e, q.id)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6B7280' }}
                          title="Edit Settings"
                        >
                          <Settings size={16} />
                        </button>
                        <button 
                            className="btn-icon-danger"
                            onClick={(e) => handleDeleteQuiz(e, q.id, q.title)}
                            title="Delete Assignment"
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', color: '#9ca3af' }}
                        >
                            <Trash2 size={16} />
                        </button>
                        </div>
                    )}
                  </div>
                </div>
                <div className="modal-subtext" style={{ textAlign: 'left', margin: 0, display: 'grid', gap: 4 }}>
                  <span><strong style={{ color: '#2C3E50' }}>Opens:</strong> {fmt(q.startAt)}</span>
                  <span><strong style={{ color: '#2C3E50' }}>Closes:</strong> {fmt(q.endAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {attemptsFooterWarn && (
        <div className="rms-warn" role="status" aria-live="polite" style={{ marginTop: 8, flex: '0 0 auto' }}>
          <span className="rms-warn-text">{attemptsFooterWarn}</span>
        </div>
      )}

      <div className="button-section assessment-layout__footer" style={{ flex: '0 0 auto' }}>
        {isEducator && (
          <button
            className={`btn ${selectedRow ? 'btn-secondary' : 'btn-disabled'}`}
            onClick={handlePreviewSelected}
            disabled={!selectedRow}
            style={{ marginLeft: 'auto' }}
          >
            Preview
          </button>
        )}

        {!isEducator && (
          <button
            className={`btn ${selectedRow && selectedRow.status === 'open' && !inFlightStartId ? 'btn-primary' : 'btn-disabled'}`}
            onClick={() => selectedAssignmentId && handleOpenQuiz(selectedAssignmentId)}
            disabled={!selectedRow || selectedRow.status !== 'open' || !!inFlightStartId}
            style={{ marginLeft: 'auto' }}
          >
            {inFlightStartId ? 'Starting…' : 'Start quiz'}
          </button>
        )}
      </div>


      {/*  Internal Metadata Settings Form. 
          Satisfies SOLID principles by isolating metadata logic from the list logic.
      */}
      {isSettingsOpen && editTargetData && (
        <AssessmentSettingsForm 
          docId={docId}
          assignmentId={editTargetData.id}
          initialTitle={editTargetData.title}
          initialStart={editTargetData.startAt}
          initialEnd={editTargetData.endAt}
          initialLimit={editTargetData.attemptLimit}
          onClose={() => { setSettingsOpen(false); setEditTargetId(null); }}
        />
      )}

      {isCreateModalOpen && isEducator && (
        <AssignQuizModal
          isOpen
          onClose={handleCreateQuizClose}
          onCreate={handleCreateQuizSubmit}
          defaultOpenDropdown
          isEducator={!!isEducator}
          onCreated={({ assignmentId }) => {
            setSelectedAssignmentId(assignmentId);
            setCreateModalOpen(false);
          }}
        />
      )}

      {overlayOpen && (
        <QuizOverlay
          isOpen
          onClose={() => { setOverlayOpen(false); setAttemptsFooterWarn(null); }}
          quizType={overlayType}
          title={overlayTitle}
          quizData={overlayData}
          resourceId={selectedAssignmentId || undefined}
          isAssessment={overlayMode === 'assessment'}
          onSubmitResults={overlayMode === 'assessment' ? submitResults : undefined}
          attemptsRemaining={overlayMode === 'assessment' ? overlayAttemptsRemaining : undefined}
        />
      )}
    </div>
  );
}

export default AssessmentTab;