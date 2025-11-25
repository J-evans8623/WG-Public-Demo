// app/workspace/(studygraph)/components/modals/AssessmentTab.tsx
/**
 * @file AssessmentTab.tsx
 * @description
 *   The Assessment tab surfaces assigned-quiz workflows and, in this revision, applies
 *   **pessimistic role gating**: creation and gradebook actions are rendered **only** when the
 *   user is explicitly confirmed to be an Educator. For Scholars—and for any state where the
 *   account type has not been resolved yet—we render no authoring controls at all. This stricter
 *   stance avoids flicker and prevents UI probes where disabled buttons might hint at hidden
 *   capabilities. The list of assigned quizzes remains visible to all roles. The component keeps
 *   its modal wiring for AssignQuizModal and GradebookModal, and logs key checkpoints with stable
 *   4-digit codes for observability. Rendering the list is O(N); all other interactions are O(1).
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import '@/app/workspace/(studygraph)/components/modals/modalStyles.css';
import './ReviewModalSystem.css';
import AssignQuizModal, {
  type CreateQuizPayload,
  type LessonLite,
} from './AssignQuizModal';
import { useApiContext } from '@/app/src/context/ApiContext';
import { useResourceContext } from '@/app/Library/Context/ResourceContext'; 
import QuizOverlay from '../Canvas/ReadWriteCanvas/Overlays/QuizOverlay';
import type { QuizAssessmentResource, QuizBinding } from '@/app/Library/Definitions/Definitions'; 
import GradebookModal from './GradebookModal';
import './AssessmentLayout.css';

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

const fmt = (d: string) =>
  new Date(d).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

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

/**
 * AssessmentTab
 * @description
 *   Presents assigned quizzes to all users and renders authoring/gradebook actions only for
 *   confirmed Educators. We intentionally hide the buttons during loading (pessimistic default)
 *   so Scholars never see disabled affordances. Major actions and gating decisions are logged.
 *   Complexity: O(N) for list rendering; O(1) otherwise.
 */
const AssessmentTab: React.FC<AssessmentTabProps> = ({
  onCreateAssignedQuiz,
  onViewGradebook,
  onClose,
  lessons = [],
  onCreateQuiz,
  docId,
}) => {
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isGradebookOpen, setIsGradebookOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  type OverlayMode = 'assessment' | 'preview';
const [overlayMode, setOverlayMode] = useState<OverlayMode>('assessment');

  // Section: Data sources (gradebook + yjs fallback) 
  const { selectQuizAssessments } = useResourceContext();


   const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayTitle, setOverlayTitle] = useState('');
  const [overlayType, setOverlayType] = useState<any>('multipleChoice');
  const [overlayData, setOverlayData] = useState<any[]>([]);
  const [ attemptId, setattemptId] = useState<string | null>(null);


  
  // Role gating (pessimistic): only show actions when explicitly educator
  const { accountStatus, isAccountLoading , startAttempt, submitAttempt } = useApiContext();
  const isEducator = accountStatus?.accountType === 'educator';

  // -------------------- Attempts UX state --------------------
  const [attemptsFooterWarn, setAttemptsFooterWarn] = useState<string | null>(null); // update - 1001
  const [inFlightStartId, setInFlightStartId] = useState<string | null>(null); // update - 1002
  const [overlayAttemptsRemaining, setOverlayAttemptsRemaining] = useState<number>(0); // update - 1003


 // Compute UI rows (gradebook first, Yjs fallback)
  const rows = useMemo(() => {
    const headers = selectQuizAssessments().map((c) => ({
          assignmentId: c.assignmentId,
          title: c.title || 'Untitled',
          startAt: c.window?.startAt ?? '',
          endAt: c.window?.endAt ?? '',
          attemptLimit:
            Number.isFinite(c.attemptLimit) && (c.attemptLimit as number) > 0 ? (c.attemptLimit as number) : 1,
        }));

    const now = Date.now();
    return headers.map((h) => {
      const start = h.startAt ? new Date(h.startAt).getTime() : Number.NEGATIVE_INFINITY;
      const end = h.endAt ? new Date(h.endAt).getTime() : Number.POSITIVE_INFINITY;
      let status: RowStatus = 'upcoming';
      if (now >= start && now <= end) status = 'open';
      if (now > end) status = 'closed';
      return { 
        id: h.assignmentId,
        title: h.title, 
        startAt: h.startAt, 
        endAt: h.endAt, 
        status, 
        attemptLimit: (h as any).attemptLimit ?? 1 
      };
    });
  }, [selectQuizAssessments]);
  

  /** 
   * openCreateQuiz
   * @description
   *   Opens the AssignQuizModal for Educators only. If gating fails, it no-ops and logs.
   */
  const openCreateQuiz = () => {
    if (!isEducator) {
      console.log('[AssessmentTab.tsx][8251] actions hidden — non-educator or loading; Create blocked', {
        isAccountLoading, role: accountStatus?.accountType,
      }); 
      return;
    }
    console.log('[AssessmentTab.tsx][8242] Create Assigned Quiz clicked — opening AssignQuizModal');
    onCreateAssignedQuiz?.();
    setCreateModalOpen(true);
  };

  /**
   * getInlineSpecForAssignment
   * @description
   *   Resolve the inline quiz spec for an assignment by reading the Yjs quizAssessment card.
   *   This supports the “server returns only attemptId” path and keeps overlay rendering O(1).
   *   Returns `{ title, quizType, quizContent }` or `null` if not found/malformed.
   */
  const getInlineSpecForAssignment = useCallback(
    (assignmentId: string):
      | { title: string; quizType: string; quizContent: any[] }
      | null => {
      const card: QuizAssessmentResource | undefined = selectQuizAssessments().find(
        (c) => c.assignmentId === assignmentId
      );
      if (!card) return null;
      const binding = card.binding as QuizBinding;
      if (!binding || binding.mode !== 'inline' || !binding.spec) return null;
      return { title: card.title || 'Quiz', quizType: binding.spec.quizType as any, quizContent: binding.spec.quizContent as any[] };
    },
    [selectQuizAssessments]
  );



/**
   * Start attempt and open overlay.
   * Server returns only { attemptId, remainingAttempts }; quiz spec is loaded from Yjs.
   */
  const handleOpenQuiz = useCallback(
    async (assignmentId: string) => {
      if (inFlightStartId) {
        console.log('[AssessmentTab.tsx][8600] startAttempt ignored (in-flight)', { inFlightStartId });
        return;
      }
      setAttemptsFooterWarn(null);
      setInFlightStartId(assignmentId);
      console.log('[AssessmentTab.tsx][8601] startAttempt begin', { docId, assignmentId });

      try {
        const res = await startAttempt({ docId, assignmentId });
        const local = getInlineSpecForAssignment(assignmentId);

        if (!local) {
          console.warn('[AssessmentTab.tsx][8606] attempt started but no local inline spec found; refreshing gradebook');
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

        console.log('[AssessmentTab.tsx][8602] startAttempt ok', {
          attemptId: res.attemptId,
          quizType: local.quizType,
          qLen: local.quizContent.length,
          remainingAfterStart: Number(res.remainingAttempts ?? 0),
        });
      } catch (e: any) {
        console.warn('[AssessmentTab.tsx][8699] startAttempt error', e?.message);
        setAttemptsFooterWarn(e?.message || 'Unable to start quiz. Please try again.');
        try {
        } catch (e2: any) {
          console.warn('[AssessmentTab.tsx][8697] refresh after error failed', e2?.message);
        }
      } finally {
        setInFlightStartId(null);
      }
    },
    [inFlightStartId, docId, startAttempt, getInlineSpecForAssignment]
  );


  /**
   * submitResults
   * @description
   *   Called by the overlay when a quiz is submitted. Sends results to the server via
   *   `submitAttempt` using attemptId when available (preferred), otherwise by assignmentId.
   *   After server acceptance, triggers a gradebook `refresh()` and clears local active state.
   *   Complexity: O(1) client-side (network-bound). Purposeful logs surround request lifecycle.
   */
  const submitResults = useCallback(
    async (scorePct: number, details: any[]) => {
      try {
        console.log('[AssessmentTab.tsx][8603] submitAttempt begin (overlay handled attempt)', {
          scorePct,
          answersLen: details?.length ?? 0,
        });
        // The overlay submits via attemptId path only; if it ever changes to
        // let parent submit, you’d need to plumb attemptId through local state.
        // Currently, the overlay itself calls back to us and the server keeps the attempt context.
        await submitAttempt({ docId,  attemptId, scorePct, clientMeta: { clientTs: new Date().toISOString() } } as any);
        // ^^^^^ Note:
        // If you want parent-owned submission, store the attemptId in state at start time
        // and pass it here. Otherwise, keep overlay-owned submission (recommended).
      } catch (e: any) {
        console.warn('[AssessmentTab.tsx][8698] submitAttempt failed', e?.message);
      } finally {
        console.log('[AssessmentTab.tsx][8604] gradebook refreshed after submit');
      }
    },
    [ attemptId, docId, submitAttempt]
  );


  /**
   * handleCreateQuizSubmit
   * @description
   *   Receives modal payload and forwards upstream, then closes the modal.
   */
  const handleCreateQuizSubmit = (payload: CreateQuizPayload) => {
    console.log('[AssessmentTab.tsx][8243] AssignQuizModal submit payload', payload);
    onCreateQuiz?.(payload);
    setCreateModalOpen(false);
  };




  /** Close AssignQuizModal without submit. */
  const handleCreateQuizClose = () => {
    console.log('[AssessmentTab.tsx][8244] AssignQuizModal closed without submit');
    setCreateModalOpen(false);
  };

  /** Open Gradebook (Educator only). */
  const openGradebook = () => {
    if (!isEducator) {
      console.log('[AssessmentTab.tsx][8252] actions hidden — non-educator or loading; Gradebook blocked', {
        isAccountLoading, role: accountStatus?.accountType,
      }); 
      return;
    }
    console.log('[AssessmentTab.tsx][8245] View Grade Book clicked — opening GradebookModal');
    onViewGradebook?.();
    setIsGradebookOpen(true);
  };

   // Small neutral chip renderer (inline style to avoid new CSS file) — O(1) 
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

// --- snippet: AssessmentTab.tsx (derived selected row) ---
const selectedRow = useMemo(                           // (update - 1105)
  () => rows.find(r => r.id === selectedAssignmentId) ?? null,
  [rows, selectedAssignmentId]
);


/**
 * handlePreviewSelected
 * @description
 *   Opens the selected quiz in **Preview** mode (non-graded). Pulls inline spec from Yjs.
 *   Steps:
 *   1) Guard if nothing is selected.
 *   2) Resolve the inline spec for the assignment.
 *   3) If not found, surface a lightweight warning.
 *   4) Otherwise, populate overlay state and open with `isAssessment=false`.
 */
const handlePreviewSelected = useCallback(() => {      // (update - 1104)
  // 1) Guard
  if (!selectedAssignmentId) return;
  // 2) Resolve inline spec (O(1) lookup)
  const local = getInlineSpecForAssignment(selectedAssignmentId);
  // 3) Warn if missing
  if (!local) {
    setAttemptsFooterWarn('Unable to preview: quiz content not found.');
    return;
  }
  // 4) Populate overlay for Preview
  setOverlayTitle(local.title);
  setOverlayType(local.quizType);
  setOverlayData(local.quizContent);
  setOverlayMode('preview');
  setOverlayOpen(true);
}, [selectedAssignmentId, getInlineSpecForAssignment]);


/**
 * focusSelectedRow
 * @description
 *   When `selectedAssignmentId` changes (e.g., after creation) and the row exists,
 *   scroll it into view and move focus for immediate visual confirmation.
 *   Steps:
 *   1) Guard when nothing is selected.
 *   2) Query the DOM for the row using a data attribute.
 *   3) Scroll to center and focus it.
 */
useEffect(() => {                                      // (update - 1103)
  // 1) Guard
  if (!selectedAssignmentId) return;
  // 2) Query for the row
  const el = document.querySelector(
    `[data-assignment-id="${selectedAssignmentId}"]`
  ) as HTMLElement | null;
  // 3) Scroll & focus
  if (el) {
    el.scrollIntoView({ block: 'center' });
    el.focus?.();
  }
}, [selectedAssignmentId, rows]); // re-evaluate when list changes


 return (
    <div className="assessment-layout">
      {/* Primary actions — strict: render ONLY for confirmed Educators (no placeholders). */}
      {isEducator && (
        <div className="button-section" style={{ justifyContent: 'flex-start', gap: 16, marginTop: 0 }}>
          <button className="btn btn-primary" onClick={openCreateQuiz}>
            Create Assigned Quiz
          </button>
          <button className="btn btn-secondary" onClick={openGradebook}>
            View Grade Book
          </button>
        </div>
      )}

      {/* Assigned quizzes list */}
      <div style={{ marginTop: 16 }}>
        {rows.length === 0 ? (
          <div className="modal-subtext" style={{ textAlign: 'left' }}>
            No assigned quizzes yet.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {rows.map((q) => (
              <li
                key={q.id}
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
                aria-label={`Open ${q.title} (${q.status})`}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <span className="radio-label">{q.title}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {renderMaxAttemptsChip(q.attemptLimit)}
                    {statusChip(q.status)}
                  </div>
                </div>
                <div
                  className="modal-subtext"
                  style={{ textAlign: 'left', margin: 0, display: 'grid', gap: 4 }}
                >
                  <span>
                    <strong style={{ color: '#2C3E50' }}>Opens:</strong> {fmt(q.startAt)}
                  </span>
                  <span>
                    <strong style={{ color: '#2C3E50' }}>Closes:</strong> {fmt(q.endAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Contextual amber warning for blocked starts */} {/* update - 1017 */}
      {attemptsFooterWarn && (
        <div className="rms-warn" role="status" aria-live="polite" style={{ marginTop: 8 }}>
          <div className="rms-warn-left">
            <span className="rms-warn-text">{attemptsFooterWarn}</span>
          </div>
        </div>
      )}

      {/* Footer (anchored) */}
      <div className="button-section assessment-layout__footer">

        {/* Educator-only Preview (non-graded) */} {/* (update - 1108) */}
        {isEducator && (
          <button
            className={`btn ${selectedRow ? 'btn-secondary' : 'btn-disabled'}`}
            onClick={handlePreviewSelected}
            disabled={!selectedRow}
            aria-disabled={!selectedRow}
            style={{ marginLeft: 'auto' }}
          >
            Preview
          </button>
        )}

        {/* Scholar path: explicit Start (graded) */} {/* (update - 1109) */}
        {!isEducator && (
          <button
            className={`btn ${
              selectedRow && selectedRow.status === 'open' && !inFlightStartId ? 'btn-primary' : 'btn-disabled'
            }`}
            onClick={() => selectedAssignmentId && handleOpenQuiz(selectedAssignmentId)}
            disabled={!selectedRow || selectedRow.status !== 'open' || !!inFlightStartId}
            aria-disabled={!selectedRow || selectedRow.status !== 'open' || !!inFlightStartId}
            style={{ marginLeft: 'auto' }}
          >
            {inFlightStartId ? 'Starting…' : 'Start quiz'}
          </button>
        )}
      </div>

      {/* Portals/overlays remain unchanged … */}
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
            console.log('[AssessmentTab.tsx][1110] onCreated received; selected new assignment', { assignmentId });
          }}
        />
      )}

      {isGradebookOpen && isEducator && (
        <GradebookModal
          isOpen
          onClose={() => {
            console.log('[AssessmentTab.tsx][8246] GradebookModal closed');
            setIsGradebookOpen(false);
          }}
          docId={docId}
        />
      )}

      {overlayOpen && (
        <QuizOverlay
          isOpen
          onClose={() => {
            setOverlayOpen(false);
            setAttemptsFooterWarn(null);
            console.log('[AssessmentTab.tsx][8605] overlay closed');
          }}
          quizType={overlayType}
          title={overlayTitle}
          quizData={overlayData}
          isAssessment={overlayMode === 'assessment'}
          onSubmitResults={overlayMode === 'assessment' ? submitResults : undefined}
          attemptsRemaining={overlayMode === 'assessment' ? overlayAttemptsRemaining : undefined}
        />
      )}
    </div>
  );
}

export default AssessmentTab;
