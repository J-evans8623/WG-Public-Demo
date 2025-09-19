/**
 * @file GradebookModal.tsx
 * @description
 *   (update - 1)
 *   A large-format modal that renders a simple gradebook grid where rows represent students
 *   and columns represent assigned quizzes. This component is intentionally “view-only” and
 *   focuses on fast rendering, approachable styling, and predictable scrolling behavior.
 *   It owns a single scroll container that supports both horizontal and vertical overflow,
 *   with a sticky header row and a sticky first column so the user always sees context while
 *   scrolling. For stress testing (as requested), the modal now generates a **large mock data
 *   set** by default (60 students × 16 assignments ≈ 960 cells) but allows overriding with
 *   props. The grid render is O(S×A) where S is the number of students and A is the number of
 *   assignments; mock generation is O(S×A) as well. Purposeful console logging is included to
 *   expose critical checkpoints: open, close, data generation, and refresh.
 *
 * Responsibilities:
 *   1) Provide a brand-aligned, larger modal shell dedicated to tabular grade display.
 *   2) Render column headers with assignment title and time window; stick the header on scroll.
 *   3) Render student rows; keep the “Name / Email” first column sticky on horizontal scroll.
 *   4) Handle internal mock-data generation for stress testing, plus a manual “Refresh” action.
 *   5) Preserve a single scroll container and comfortable gutters to avoid cramped UI.
 */

import React, { useMemo, useState } from 'react';
import '@/app/studygraph/(studygraph)/components/modals/modalStyles.css';
import './gradebook.css';

type Assignment = {
  id: string;
  title: string;
  startAt: string; // ISO
  endAt: string;   // ISO
};

type Student = {
  id: string;
  email: string;
  name?: string;
};

type GradeGrid = Record<string, Record<string, number | null>>; // studentId -> assignmentId -> score% | null

export interface GradebookModalProps {
  isOpen: boolean;
  onClose: () => void;

  /** (update - 2) Optional overrides to control mock size for stress testing. */
  mockStudentCount?: number;
  mockAssignmentCount?: number;

  /** (optional) Supply real data to bypass mock generation. */
  students?: Student[];
  assignments?: Assignment[];
  grid?: GradeGrid;

  /** (optional) External refresh hook; if omitted, refresh regenerates mock data. */
  onRefresh?: () => void;
}

/**
 * formatWindow
 * @description
 *   Return a concise local time-window label for an assignment header. This keeps the
 *   component readable while still conveying the availability window to educators.
 *   All operations are O(1) and locale-aware via toLocaleString.
 */
function formatWindow(a: Assignment): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  };
  return `${new Date(a.startAt).toLocaleString(undefined, opts)} – ${new Date(a.endAt).toLocaleString(undefined, opts)}`;
}

/**
 * generateMockData
 * @description
 *   (update - 3)
 *   Produce a large, but deterministic, mock dataset for stress testing the grid. We generate
 *   N students and M assignments, then fill a sparse score table with random percentages
 *   (including some nulls). Complexity is O(S×A). The function is pure and memo-friendly.
 */
function generateMockData(studentCount: number, assignmentCount: number) {
  const baseNow = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const students: Student[] = Array.from({ length: studentCount }, (_, i) => {
    const num = (i + 1).toString().padStart(2, '0');
    return {
      id: `stu-${num}`,
      email: `student${num}@school.edu`,
      name: Math.random() > 0.4 ? `Student ${num}` : undefined,
    };
  });

  const assignments: Assignment[] = Array.from({ length: assignmentCount }, (_, j) => {
    const idx = (j + 1).toString().padStart(2, '0');
    const start = baseNow - (j % 5) * day + j * 12345; // spread the dates a bit
    const end = start + 3 * day + (j % 3) * 3600_000;
    return {
      id: `aq-${idx}`,
      title: `Assigned Quiz ${idx}`,
      startAt: new Date(start).toISOString(),
      endAt: new Date(end).toISOString(),
    };
  });

  const grid: GradeGrid = {};
  for (const s of students) {
    grid[s.id] = {};
    for (const a of assignments) {
      // ~85% filled, some nulls for realism
      const filled = Math.random() > 0.15;
      grid[s.id][a.id] = filled ? Math.round(50 + Math.random() * 50) : null;
    }
  }

  return { students, assignments, grid };
}

const GradebookModal: React.FC<GradebookModalProps> = ({
  isOpen,
  onClose,
  mockStudentCount = 60,     // (update - 4) larger default set
  mockAssignmentCount = 16,  // (update - 4) larger default set
  students: providedStudents,
  assignments: providedAssignments,
  grid: providedGrid,
  onRefresh,
}) => {
  // (update - 5) Seed mock data once on open; allow refresh to regenerate
  const initialData = useMemo(() => {
    if (providedStudents && providedAssignments && providedGrid) {
      console.log('[GradebookModal.tsx][7711] using provided gradebook data');
      return {
        students: providedStudents,
        assignments: providedAssignments,
        grid: providedGrid,
      };
    }
    console.log('[GradebookModal.tsx][7712] generating mock data', {
      students: mockStudentCount,
      assignments: mockAssignmentCount,
    });
    return generateMockData(mockStudentCount, mockAssignmentCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providedStudents, providedAssignments, providedGrid, isOpen]);

  const [data, setData] = useState(initialData);

  if (!isOpen) return null;

  const { students, assignments, grid } = data;

  const handleRefresh = () => {
    console.log('[GradebookModal.tsx][7713] refresh clicked');
    if (onRefresh) {
      onRefresh();
      return;
    }
    const regenerated = generateMockData(mockStudentCount, mockAssignmentCount);
    setData(regenerated);
  };

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
            </div>
            <button className="btn btn-secondary" onClick={handleRefresh}>
              Refresh
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

        {/* Grid body */}
        <div className="gb-body">
          <div className="gb-grid-wrapper">
            <table className="gb-table" role="table" aria-label="Gradebook">
              <thead>
                <tr>
                  <th className="gb-th gb-sticky-left gb-sticky-top" style={{ zIndex: 3 }}>
                    Name / Email
                  </th>
                  {assignments.map((a) => (
                    <th key={a.id} className="gb-th gb-sticky-top">
                      <div className="gb-th-title">{a.title}</div>
                      <div className="gb-th-sub">{formatWindow(a)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s, rIndex) => (
                  <tr key={s.id} className={rIndex % 2 === 0 ? 'gb-row-even' : 'gb-row-odd'}>
                    <td className="gb-td gb-sticky-left">
                      <div className="gb-student">
                        <div className="gb-student-name">{s.name ?? s.email.split('@')[0]}</div>
                        <div className="gb-student-email">{s.email}</div>
                      </div>
                    </td>
                    {assignments.map((a, cIndex) => {
                      const score = grid[s.id]?.[a.id] ?? null;
                      const cls =
                        score === null
                          ? 'gb-score gb-score-missing'
                          : score >= 85
                          ? 'gb-score gb-score-high'
                          : score >= 70
                          ? 'gb-score gb-score-mid'
                          : 'gb-score gb-score-low';
                      return (
                        <td key={`${s.id}-${a.id}`} className="gb-td" data-col={cIndex + 1}>
                          <div className={cls}>{score === null ? '—' : `${score}%`}</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GradebookModal;
