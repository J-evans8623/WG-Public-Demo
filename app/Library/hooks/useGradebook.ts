// app/Library/hooks/useGradebook.ts
/**
 * @file useGradebook.ts
 * @description
 *   This file implements the production-ready `useGradebook(docId)` React hook and a compact,
 *   per-document in-memory cache with pub/sub so multiple subscribers (e.g., GradebookModal,
 *   AssignQuizModal) can share a single authoritative gradebook snapshot. In this revision we
 *   intentionally **remove all Yjs dependencies** and any merging logic with client-side
 *   `quizAssessment` cards; the **server** is now the single source of truth for *all three lanes*:
 *   `assignments`, `students`, and `grid`. The hook exposes a small, ergonomic surface:
 *   1) `refresh()` to fetch the latest snapshot on demand,
 *   2) `applyAttemptResult()` for optimistic, single-cell updates between submissions and refreshes,
 *   3) `upsertAssignmentMeta()` for optimistic, in-memory header patches after successful network
 *   writes. This keeps the implementation simple, predictable, and testable, reduces coupling
 *   (no editor-state concerns), and makes operational behavior explicit. Complexity is O(1) for
 *   reads/mutations against the cache and O(S + A + C) for merges where S=students, A=assignments,
 *   and C=cells returned by the backend.
 *
 *   Responsibilities (step-by-step):
 *   1) Maintain a process-wide, per-`docId` in-memory store with pub/sub for UI subscribers.
 *   2) Fetch server snapshots on demand and **set** assignments, students, and grid from the server.
 *   3) Offer optimistic mutations (assignment header nudge & attempt result write-through).
 *   4) Emit compact, traceable console logs at critical checkpoints for observability.
 *
 *   Performance & Big-O:
 *   - Reading/serving from the cache is O(1) for lookups; merging server results is
 *     O(S + A + C) where S=students, A=assignments, C=cells in the payload.
 *   - Optimistic cell writes and header upserts are O(1) and O(A) respectively.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApiContext } from '@/app/src/context/ApiContext'; // update - 1 (removed ResourceContext/Yjs imports)
import type { // update - 2
  AssignmentHeader,
  GradebookCell,
  GradebookQueryRes,
} from '@/app/workspace/(studygraph)/services/gradebook/gradebookClient';

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
   *   Imperative fetch that loads an authoritative gradebook snapshot from the backend and writes
   *   **all three lanes** (assignments, students, grid) into the per-doc cache, then notifies all
   *   subscribers. The hook sets `status='updating'` while the request is in flight, and resets to
   *   `ready` (or `error` on failure). Callers choose when to load (e.g., on modal open).
   *   Complexity: network-bound; merge is O(S + A + C).
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
   *   Optimistically creates or updates a single assignment header in the column list after the
   *   server has accepted an upsert/patch. This keeps UI snappy while a background `refresh()`
   *   reconciles in case the server normalizes values. Complexity: O(A) to scan/patch.
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
    // console.log('useGradebook.ts [9301] › cache init', { docId }); // update - 3
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
      console.warn('useGradebook.ts [9397] › subscriber threw', e); // update - 4
    }
  });
}

function _subscribe(docId: string, cb: () => void): () => void {
  const set = _subs.get(docId) ?? new Set<() => void>();
  set.add(cb);
  _subs.set(docId, set);
  console.log('useGradebook.ts [9302] › subscribe', { docId, count: set.size }); // update - 5
  return () => {
    set.delete(cb);
    if (set.size === 0) _subs.delete(docId);
    // console.log('useGradebook.ts [9303] › unsubscribe', { docId, count: set.size }); // update - 6
  };
}

function _patch(docId: string, updater: (prev: GradebookCache) => void): void {
  const s = _getOrInit(docId);
  updater(s);
  s.version++;
  _emit(docId);
}

/* =================================================================================================
 * Server snapshot merge (assignments + students + grid)
 * =================================================================================================*/

/**
 * mergeServerSnapshot
 * @description
 *   Merge an authoritative server snapshot into the per-doc cache, **writing all three lanes**:
 *   `assignments`, `students`, and `grid`. Emails are normalized defensively; `lastUpdated` is
 *   stamped for UI hints. Since this revision removes Yjs, assignments always come from the server.
 *   Complexity: O(S + A + C) over snapshot size; cache writes are O(1).
 */
function mergeServerSnapshot(docId: string, snap: GradebookQueryRes): void { // update - 7
  _patch(docId, (s) => {
    // 1) Assignments — now server-authoritative
    s.assignments = (snap.assignments || []).map((a) => ({
      assignmentId: a.assignmentId,
      title: a.title,
      startAt: a.startAt,
      endAt: a.endAt,
      attemptLimit: a.attemptLimit,
      status: a.status,
    }));

    // 2) Students (normalized)
    const students = (snap.students || []).map(_normalizeEmail);

    // 3) Grid (sparse matrix)
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

    // 4) Finalize cache state
    s.students = students;
    s.grid = grid;
    s.status = 'ready';
    s.error = null;
    s.lastUpdated = new Date().toISOString();
  });


}

/* =================================================================================================
 * Hook implementation
 * =================================================================================================*/

export function useGradebook(docId: string): UseGradebookResult {
  const { getGradebook } = useApiContext(); // update - 9 (sole external dependency now)

  // Keep a stable reference to docId for logs
  const docRef = useRef(docId);
  docRef.current = docId;

  // 1) Subscribe to the per-doc store and keep local state in sync
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = _subscribe(docId, () => setTick((t) => t + 1));
    return () => unsub();
  }, [docId]); // update - 10

  // 2) Initialize (if needed) so initial render has a value
  useEffect(() => {
    _getOrInit(docId);
  }, [docId]); // update - 11

  // 3) Derive current snapshot from the cache
  const snapshot = useMemo(() => _getOrInit(docId), [docId]); // update - 12

  // 4) Define refresh (authoritative fetch for all lanes)
  const refresh = useCallback(async () => { // update - 13
    if (!docId) return;
    if (_inFlight.has(docId)) {
      // console.log('useGradebook.ts [9306] › refresh skipped; in flight', { docId }); // update - 14
      return;
    }
    _inFlight.add(docId);
    _patch(docId, (s) => {
      s.status = 'updating';
      s.error = null;
    });
    // console.log('useGradebook.ts [9307] › refresh begin', { docId }); // update - 15

    try {
      const res = await getGradebook(docId);
      mergeServerSnapshot(docId, res);

    } catch (err: any) {
      _patch(docId, (s) => {
        s.status = 'error';
        s.error = String(err?.message || 'UNKNOWN');
      });
      console.error('useGradebook.ts [9398] › refresh error', { docId, message: err?.message }); // update - 17
    } finally {
      _inFlight.delete(docId);
    }
  }, [docId, getGradebook]);

  // 5) Optimistic cell write
  const applyAttemptResult = useCallback( // update - 18
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
   */
  const upsertAssignmentMeta = useCallback( // update - 20
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

    },
    [docId]
  );

  // 6) Return shallow copies for arrays (stable object identity for grid)         // update - 22
  const result: UseGradebookResult = useMemo(
    () => ({
      assignments: [...snapshot.assignments], // update - 23
      students: [...snapshot.students],       // update - 24
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
