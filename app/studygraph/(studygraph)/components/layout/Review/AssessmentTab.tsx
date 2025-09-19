// app/studygraph/(studygraph)/components/modals/AssessmentTab.tsx
/**
 * @file AssessmentTab.tsx
 * @description
 *   (update - 1)
 *   The Assessment tab surfaces assigned-quiz workflows and, in this revision, applies
 *   **pessimistic role gating**: creation and gradebook actions are rendered **only** when the
 *   user is explicitly confirmed to be an Educator. For Scholars—and for any state where the
 *   account type has not been resolved yet—we render no authoring controls at all. This stricter
 *   stance avoids flicker and prevents UI probes where disabled buttons might hint at hidden
 *   capabilities. The list of assigned quizzes remains visible to all roles. The component keeps
 *   its modal wiring for AssignQuizModal and GradebookModal, and logs key checkpoints with stable
 *   4-digit codes for observability. Rendering the list is O(N); all other interactions are O(1).
 */

import React, { useMemo, useState } from 'react';
import '@/app/studygraph/(studygraph)/components/modals/modalStyles.css';
import './ReviewModalSystem.css';
import AssignQuizModal, {
  type CreateQuizPayload,
  type LessonLite,
} from './AssignQuizModal';
import GradebookModal from './GradebookModal';
import { useApiContext } from '@/app/src/context/ApiContext';

export interface AssessmentTabProps {
  onCreateAssignedQuiz?: () => void;
  onViewGradebook?: () => void;
  onClose: () => void;
  lessons?: LessonLite[];
  onCreateQuiz?: (payload: CreateQuizPayload) => void;
  /** Current document id (fileID) used for quiz generation and gradebook scoping. */
  docId: string; // update - 2
}

type AssignedQuiz = {
  id: string;
  title: string;
  startAt: string; // ISO
  endAt: string;   // ISO
};

const MOCK_QUIZZES: AssignedQuiz[] = [
  {
    id: 'aq-101',
    title: 'Unit 3 – Cellular Respiration',
    startAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    endAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
  {
    id: 'aq-102',
    title: 'Interleaved Set A – Weeks 1–2',
    startAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 1).toISOString(),
    endAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
  },
  {
    id: 'aq-103',
    title: 'Mid-Unit Checkpoint',
    startAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    endAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  },
  {
    id: 'aq-104',
    title: 'Cumulative Review (Weeks 1–4)',
    startAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
    endAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString(),
  },
];

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
 *   (update - 3)
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

  // Role gating (pessimistic): only show actions when explicitly educator
  const { accountStatus, isAccountLoading } = useApiContext();
  const isEducator = accountStatus?.accountType === 'educator';

  const now = Date.now();

  const rows = useMemo(
    () =>
      MOCK_QUIZZES.map((q) => {
        const start = new Date(q.startAt).getTime();
        const end = new Date(q.endAt).getTime();
        let status: 'upcoming' | 'open' | 'closed' = 'upcoming';
        if (now >= start && now <= end) status = 'open';
        if (now > end) status = 'closed';
        return { ...q, status };
      }),
    [now]
  );

  console.log('[AssessmentTab.tsx][8241] assigned quizzes populated', { count: rows.length });

  /** 
   * openCreateQuiz
   * @description
   *   Opens the AssignQuizModal for Educators only. If gating fails, it no-ops and logs.
   */
  const openCreateQuiz = () => {
    if (!isEducator) {
      console.log('[AssessmentTab.tsx][8251] actions hidden — non-educator or loading; Create blocked', {
        isAccountLoading, role: accountStatus?.accountType,
      }); // update - 4
      return;
    }
    console.log('[AssessmentTab.tsx][8242] Create Assigned Quiz clicked — opening AssignQuizModal');
    onCreateAssignedQuiz?.();
    setCreateModalOpen(true);
  };

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
      }); // update - 5
      return;
    }
    console.log('[AssessmentTab.tsx][8245] View Grade Book clicked — opening GradebookModal');
    onViewGradebook?.();
    setIsGradebookOpen(true);
  };

  return (
    <div>
      {/* Primary actions — strict: render ONLY for confirmed Educators (no placeholders). */} {/* update - 6 */}
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

      {/* Assigned quizzes list (parent body owns scrolling) */}
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
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginBottom: 12,
                  padding: 14,
                }}
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
                  {statusChip(q.status)}
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

      {/* Footer */}
      <div className="button-section" style={{ marginTop: 24 }}>
        <button className="btn btn-cancel" onClick={onClose}>
          Close
        </button>
      </div>

      {/* Create Quiz Modal — mounting still guarded by click path; extra safety if rendered */}
      {isCreateModalOpen && isEducator && ( // update - 8
        <AssignQuizModal
          isOpen
          onClose={handleCreateQuizClose}
          onCreate={handleCreateQuizSubmit}
          defaultOpenDropdown           // unchanged pass-through
          isEducator={!!isEducator} // unchanged pass-through
        />
      )}

      {/* Gradebook Modal — only mount when explicitly opened by an Educator */}
      {isGradebookOpen && isEducator && ( // update - 9
        <GradebookModal
          isOpen
          onClose={() => {
            console.log('[AssessmentTab.tsx][8246] GradebookModal closed');
            setIsGradebookOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default AssessmentTab;
