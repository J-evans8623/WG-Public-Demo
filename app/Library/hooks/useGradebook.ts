/**
 * @file useGradebook.ts
 * @description
 *   This file implements the production-ready `useGradebook(docId)` React hook and a small,
 *   per-document in-memory cache that composes two independent data sources into a single,
 *   ergonomic interface for Gradebook UIs. (1) It consumes **Yjs** via `ResourceContext` to
 *   discover live `quizAssessment` assignment cards that render as gradebook columns, and (2)
 *   it fetches authoritative grades and student rosters from the **BFF/Firestore** through
 *   `ApiContext.getGradebook`. The hook exposes the merged `{ assignments, students, grid }`,
 *   a `status` state machine for UX, and imperative helpers to `refresh()` from the server,
 *   `applyAttemptResult()` for optimistic cell updates, and `upsertAssignmentMeta()` to nudge
 *   headers after assignment authoring. It centralizes logging with stable 4-digit codes,
 *   maintains O(1)/O(N) operations where applicable, and never performs automatic fetching—
 *   callers decide when to load data. The internal cache is keyed by `docId` to avoid
 *   cross-document bleed, supports multiple subscribers, and keeps the UI snappy while
 *   deferring authority to the backend on each refresh. This isolation reduces coupling and
 *   keeps GradebookModal, QuizGate, and QuizAttemptController trivial to reason about.
 *
 *   Responsibilities (step-by-step):
 *   1) Maintain a process-wide, per-`docId` in-memory store with pub/sub for UI subscribers.
 *   2) Derive gradebook column headers from live Yjs `quizAssessment` cards.
 *   3) Fetch server snapshots on demand and normalize their shape.
 *   4) Offer optimistic mutations (assignment header nudge & attempt result write-through).
 *   5) Emit compact, traceable console logs at critical checkpoints for observability.
 *
 *   Performance & Big-O:
 *   - Reading/serving from the cache is O(1) for lookups; merging server results is
 *     O(S + A + C) where S=students, A=assignments, C=cells in the payload.
 *   - Comparing/patching assignments is O(A). Optimistic cell writes are O(1).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useResourceContext } from '@/app/Library/Context/ResourceContext';
import { QuizAssessmentResource } from '@/app/Library/Definitions/Definitions';
import { useApiContext } from '@/app/src/context/ApiContext';
import type {
  AssignmentHeader,
  GradebookCell,
  GradebookQueryRes,
} from '@/app/studygraph/(studygraph)/services/gradebook/gradebookClient';

/* =================================================================================================
 * Types
 * =================================================================================================*/

type Email = string;
type AssignmentId = string;

type GradebookGrid = Record<Email, Record<AssignmentId, GradebookCell>>;

type GradebookStatus = 'idle' | 'updating' | 'ready' | 'error';

interface GradebookCache {
  assignments: AssignmentHeader[];
  students: Email[];
  grid: GradebookGrid;
  status: GradebookStatus;
  lastUpdated?: string;
  error?: string | null;
  version: number;
}

export interface UseGradebookResult {
  assignments: AssignmentHeader[];
  students: Email[];
  grid: GradebookGrid;
  status: GradebookStatus;
  lastUpdated?: string;
  error?: string | null;
  /**
   * refresh
   * @description
   *   Imperative fetch that loads an authoritative gradebook snapshot from the backend, merges it
   *   into the per-doc cache, and notifies all subscribers. The hook sets `status='updating'`
   *   while the request is in flight, then returns to `ready` (or `error` on failure). This call
   *   never auto-retries; callers control timing (e.g., fire on modal open or via a Refresh UI).
   *   Complexity: network-bound; merge is O(S + A + C) where S students, A assignments, C cells.
   */
  refresh: () => Promise<void>;
  /**
   * applyAttemptResult
   * @description
   *   Optimistically writes a `{scorePct, submittedAt}` cell for the given `(email, assignmentId)`
   *   directly into the in-memory grid, emits a change event, and keeps the matrix consistent
   *   between submission and the next server `refresh()`. Consumers should pass the authenticated
   *   user’s normalized email (lowercase). Complexity: O(1) for single-cell update.
   */
  applyAttemptResult: (
    email: Email,
    assignmentId: AssignmentId,
    scorePct: number,
    submittedAt?: string
  ) => void;
  /**
   * upsertAssignmentMeta
   * @description
   *   Optimistically creates or updates a single assignment header within the column list. This
   *   is used by authoring flows (e.g., AssignQuizModal) after successfully persisting metadata
   *   to the backend so the UI is immediately coherent while awaiting `refresh()`. It preserves
   *   existing order where possible and performs a stable in-place patch when ids match.
   *   Complexity: O(A) to scan and patch a single header among A columns.
   */
  upsertAssignmentMeta: (header: AssignmentHeader) => void;
}

/* =================================================================================================
 * Module-level store + pub/sub
 * =================================================================================================*/

const _store = new Map<string, GradebookCache>();
const _subs = new Map<string, Set<() => void>>();
const _inFlight = new Set<string>();

function _normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

function _getOrInit(docId: string): GradebookCache {
  let s = _store.get(docId);
  if (!s) {
    s = {
      assignments: [],
      students: [],
      grid: {},
      status: 'idle',
      lastUpdated: undefined,
      error: null,
      version: 0,
    };
    _store.set(docId, s);
    console.log('useGradebook.ts [7301] › cache init', { docId });
  }
  return s;
}

function _emit(docId: string): void {
  const ls = _subs.get(docId);
  if (!ls || ls.size === 0) return;
  ls.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn('useGradebook.ts [7397] › subscriber threw', e);
    }
  });
}

function _subscribe(docId: string, cb: () => void): () => void {
  const set = _subs.get(docId) ?? new Set<() => void>();
  set.add(cb);
  _subs.set(docId, set);
  console.log('useGradebook.ts [7302] › subscribe', { docId, count: set.size });
  return () => {
    set.delete(cb);
    if (set.size === 0) _subs.delete(docId);
    console.log('useGradebook.ts [7303] › unsubscribe', { docId, count: set.size });
  };
}

function _patch(docId: string, updater: (prev: GradebookCache) => void): void {
  const s = _getOrInit(docId);
  updater(s);
  s.version++;
  _emit(docId);
}

/* =================================================================================================
 * Local helpers
 * =================================================================================================*/

/**
 * assignmentsFromYjs
 * Responsibility:
 *   Transform live Yjs `quizAssessment` cards into assignment headers expected by the gradebook.
 *   Falls back to sane defaults when optional fields are missing to keep UI resilient. The order
 *   is preserved as provided by ResourceContext to avoid surprising users in multi-editor sessions.
 */
function assignmentsFromYjs(cards: QuizAssessmentResource[]): AssignmentHeader[] {
  return cards.map((c) => ({
    assignmentId: c.assignmentId,
    title: c.title || 'Untitled',
    startAt: c.window?.startAt ?? '',
    endAt: c.window?.endAt ?? '',
    attemptLimit: Number.isFinite(c.attemptLimit) && (c.attemptLimit as number) > 0 ? (c.attemptLimit as number) : 1,
  }));
}

/**
 * shallowEqualAssignments
 * Responsibility:
 *   Determine if two assignment header lists are equivalent by id and header fields. Used to
 *   avoid unnecessary cache churn when Yjs toggles or makes no effective changes. O(A).
 */
function shallowEqualAssignments(a: AssignmentHeader[], b: AssignmentHeader[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.assignmentId !== y.assignmentId ||
      x.title !== y.title ||
      x.startAt !== y.startAt ||
      x.endAt !== y.endAt ||
      x.attemptLimit !== y.attemptLimit
    ) {
      return false;
    }
  }
  return true;
}

/**
 * mergeServerSnapshot
 * Responsibility:
 *   Merge an authoritative server snapshot into the per-doc cache, replacing the student roster
 *   and cell grid while preserving assignment headers that come from Yjs (columns remain driven
 *   by the live document). Normalizes emails defensively and stamps `lastUpdated` for UI hints.
 */
function mergeServerSnapshot(docId: string, snap: GradebookQueryRes): void {
  _patch(docId, (s) => {
    const students = (snap.students || []).map(_normalizeEmail);
    const grid: GradebookGrid = {};
    for (const [rawEmail, row] of Object.entries(snap.grades || {})) {
      const email = _normalizeEmail(rawEmail);
      grid[email] = {};
      for (const [assignmentId, cell] of Object.entries(row)) {
        grid[email][assignmentId] = {
          scorePct: (cell as any).scorePct ?? 0,
          submittedAt: (cell as any).submittedAt,
        };
      }
    }
    s.students = students;
    s.grid = grid;
    s.status = 'ready';
    s.error = null;
    s.lastUpdated = new Date().toISOString();
  });
  console.log('useGradebook.ts [7304] › merged server snapshot', {
    docId,
    students: snap.students.length,
    assignmentsReported: snap.assignments.length,
  });
}

/* =================================================================================================
 * Hook implementation
 * =================================================================================================*/

export function useGradebook(docId: string): UseGradebookResult {
  const { selectQuizAssessments } = useResourceContext();
  const { getGradebook } = useApiContext();

  // Keep a stable reference to docId for logs
  const docRef = useRef(docId);
  docRef.current = docId;

  // 1) Subscribe to the per-doc store and keep local state in sync
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const unsub = _subscribe(docId, () => setTick((t) => t + 1));
    return () => unsub();
  }, [docId]);

  // 2) Initialize (if needed) so initial render has a value
  useEffect(() => {
    _getOrInit(docId);
  }, [docId]);

  // 3) Derive current snapshot from the cache
  const snapshot = useMemo(() => _getOrInit(docId), [docId]);

  // 4) Recompute assignment headers whenever Yjs changes (function identity changes on updates)
  useEffect(() => {
    const yCards = selectQuizAssessments();
    const yHeaders = assignmentsFromYjs(yCards);

    _patch(docId, (s) => {
      if (shallowEqualAssignments(s.assignments, yHeaders)) return;
      s.assignments = yHeaders;
      // Note: grid correctness is independent from header source; no need to touch grid here.
    });

    console.log('useGradebook.ts [7305] › applied Yjs assignments', {
      docId,
      count: yHeaders.length,
    });
  }, [docId, selectQuizAssessments]);

  // 5) Define refresh (authoritative fetch)
  const refresh = useCallback(async () => {
    if (!docId) return;
    if (_inFlight.has(docId)) {
      console.log('useGradebook.ts [7306] › refresh skipped; in flight', { docId });
      return;
    }
    _inFlight.add(docId);
    _patch(docId, (s) => {
      s.status = 'updating';
      s.error = null;
    });
    console.log('useGradebook.ts [7307] › refresh begin', { docId });

    try {
      const res = await getGradebook(docId);
      mergeServerSnapshot(docId, res);
      console.log('useGradebook.ts [7308] › refresh ok', {
        docId,
        students: res.students.length,
      });
    } catch (err: any) {
      _patch(docId, (s) => {
        s.status = 'error';
        s.error = String(err?.message || 'UNKNOWN');
      });
      console.error('useGradebook.ts [7398] › refresh error', { docId, message: err?.message });
    } finally {
      _inFlight.delete(docId);
    }
  }, [docId, getGradebook]);

  // 6) Optimistic cell write
  const applyAttemptResult = useCallback(
    (email: Email, assignmentId: AssignmentId, scorePct: number, submittedAt?: string) => {
      const nEmail = _normalizeEmail(email);
      const ts = submittedAt || new Date().toISOString();

      _patch(docId, (s) => {
        if (!s.grid[nEmail]) s.grid[nEmail] = {};
        s.grid[nEmail][assignmentId] = {
          scorePct: Math.max(0, Math.min(100, Math.round(scorePct))),
          submittedAt: ts,
        };
        s.lastUpdated = ts;
      });

      console.log('useGradebook.ts [7309] › optimistic cell write', {
        docId,
        email: nEmail,
        assignmentId,
        scorePct,
      });
    },
    [docId]
  );

  /**
 * upsertAssignmentMeta
 * @description
 *   Inserts or updates a single assignment header within the per-document gradebook cache and
 *   notifies all subscribers. This function is used by authoring flows to reflect server-accepted
 *   metadata immediately, keeping the UI responsive while a subsequent `refresh()` reconciles with
 *   the authoritative backend snapshot. It preserves column order by performing in-place updates
 *   when the `assignmentId` already exists, and appends a new header otherwise. Time complexity is
 *   O(A), where A is the number of assignment columns.
 *
 *   Step-by-step:
 *   1) Look up the target assignment by `assignmentId`.
 *   2) If found, merge the provided fields into the existing header (stable index).
 *   3) If not found, append the header to the end of the list.
 *   4) Emit a cache update via `_patch` to trigger re-rendering for all subscribers.
 *   5) Log a concise, traceable message for observability and debugging.
 */
  const upsertAssignmentMeta = useCallback(
    (header: AssignmentHeader) => {
      _patch(docId, (s) => {
        const idx = s.assignments.findIndex((a) => a.assignmentId === header.assignmentId);
        if (idx >= 0) {
          // In-place patch preserves stable order
          s.assignments[idx] = {
            ...s.assignments[idx],
            ...header,
          };
        } else {
          s.assignments = [...s.assignments, header];
        }
      });
      console.log('useGradebook.ts [7310] › header upsert', {
        docId,
        assignmentId: header.assignmentId,
      });
    },
    [docId]
  );

  // 8) Return shallow copies for arrays (mutable per interface)  // update - 1
  const result: UseGradebookResult = useMemo(
    () => ({
      assignments: [...snapshot.assignments], // update - 2
      students: [...snapshot.students],       // update - 3
      grid: snapshot.grid,
      status: snapshot.status,
      lastUpdated: snapshot.lastUpdated,
      error: snapshot.error,
      refresh,
      applyAttemptResult,
      upsertAssignmentMeta,
    }),
    [
      snapshot.assignments,
      snapshot.students,
      snapshot.grid,
      snapshot.status,
      snapshot.lastUpdated,
      snapshot.error,
      refresh,
      applyAttemptResult,
      upsertAssignmentMeta,
    ]
  );

  return result;
}

export default useGradebook;
