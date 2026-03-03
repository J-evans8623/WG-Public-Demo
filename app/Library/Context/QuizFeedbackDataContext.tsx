/**
 * @file app/workspace/(studygraph)/context/QuizFeedbackDataContext.tsx
 * @description
 *   React context provider and consumer hook for the QuizFeedback feature. This file is the
 *   client-side data layer bridging the four UI components (StudentGradeList, StudentQuizDetail,
 *   EducatorQuizList, EducatorHistogram) with the BFF API layer.
 *
 *   DATA FETCHING ARCHITECTURE — one-time fetch model:
 *
 *   List-level data (studentAttempts, quizInsights) is fetched ONCE automatically by the
 *   provider's own useEffect when it mounts with a valid docId. Consumer components never
 *   call a fetch method for list data — they simply read from context. This means scene
 *   changes that unmount/remount a list component cause zero network activity; the data is
 *   already in the reducer and renders instantly.
 *
 *   Per-click detail data (quizFeedbackDetail, quizHistogram) is fetched on demand because
 *   each invocation targets a resource identified by a user-selected ID (attemptId or
 *   assignmentId). These fetches ARE cached by their respective ID using a useRef so that
 *   navigating back to a previously-viewed detail view also costs zero network round-trips.
 *   The cache is keyed by the ID string; a new ID always triggers a fresh fetch.
 *
 *   What is NOT done: consumer components do NOT call clearFeedbackDetail or clearHistogram
 *   on unmount. Clearing on unmount was the original source of the re-fetch loop — it
 *   nullified the cached result, forcing the provider to re-fetch when the component
 *   remounted. Those clear methods still exist for cases where genuinely stale data must be
 *   purged (e.g. the modal is fully closed and reopened for a different session), but they
 *   are no longer called from component cleanup effects.
 */

'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import type {
  QuizFeedbackContextValue,
  StudentAttemptSummary,
  QuizFeedbackDetail,
  QuizInsightSummary,
  QuizHistogram,
} from '@/app/src/quizFeedback/quizFeedback.types';
import { quizFeedbackClient } from '@/app/Library/Context/quizfeedback/QuizFeedbackDataClient';
import { useYDoc } from './YDocContext';

// ─────────────────────────────────────────────────────────────────────────────
// [Section 1] State shape and reducer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * QuizFeedbackState
 * @description
 *   Internal reducer state. Separated from the public context value to allow
 *   dispatch-based updates without exposing internal action types to consumers.
 */
interface QuizFeedbackState {
  studentAttempts:    StudentAttemptSummary[];
  quizFeedbackDetail: QuizFeedbackDetail | null;
  quizInsights:       QuizInsightSummary[];
  quizHistogram:      QuizHistogram | null;
  isLoading:          boolean;
  error:              string | null;
}

type QuizFeedbackAction =
  | { type: 'FETCH_START' }
  | { type: 'SET_STUDENT_ATTEMPTS';  payload: StudentAttemptSummary[] }
  | { type: 'SET_FEEDBACK_DETAIL';   payload: QuizFeedbackDetail }
  | { type: 'SET_QUIZ_INSIGHTS';     payload: QuizInsightSummary[] }
  | { type: 'SET_QUIZ_HISTOGRAM';    payload: QuizHistogram }
  | { type: 'CLEAR_FEEDBACK_DETAIL' }
  | { type: 'CLEAR_HISTOGRAM' }
  | { type: 'FETCH_ERROR';           payload: string }
  | { type: 'RESET_STATE' };

const initialState: QuizFeedbackState = {
  studentAttempts:    [],
  quizFeedbackDetail: null,
  quizInsights:       [],
  quizHistogram:      null,
  isLoading:          false,
  error:              null,
};

/**
 * quizFeedbackReducer
 * @description
 *   Pure reducer that transitions QuizFeedbackState based on dispatched actions.
 *   All async side effects happen in the provider methods; this function is
 *   intentionally synchronous and side-effect-free.
 */
function quizFeedbackReducer(
  state: QuizFeedbackState,
  action: QuizFeedbackAction,
): QuizFeedbackState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, isLoading: true, error: null };
    case 'SET_STUDENT_ATTEMPTS':
      return { ...state, isLoading: false, error: null, studentAttempts: action.payload };
    case 'SET_FEEDBACK_DETAIL':
      return { ...state, isLoading: false, error: null, quizFeedbackDetail: action.payload };
    case 'SET_QUIZ_INSIGHTS':
      return { ...state, isLoading: false, error: null, quizInsights: action.payload };
    case 'SET_QUIZ_HISTOGRAM':
      return { ...state, isLoading: false, error: null, quizHistogram: action.payload };
    case 'CLEAR_FEEDBACK_DETAIL':
      return { ...state, quizFeedbackDetail: null };
    case 'CLEAR_HISTOGRAM':
      return { ...state, quizHistogram: null };
    case 'FETCH_ERROR':
      return { ...state, isLoading: false, error: action.payload };
    case 'RESET_STATE':
      return { ...initialState, isLoading: true };
    default:
      return state;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 2] Per-click detail cache shape
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DetailCache
 * @description
 *   Shape of the useRef used to prevent redundant fetches on per-click detail views.
 *   Each field stores the ID string of the most recently successfully fetched resource.
 *   When the user navigates back to a detail view they have already opened, the ID
 *   matches and the fetch is skipped — the data already in the reducer is used.
 *   A useRef is chosen because updating it must never trigger a re-render.
 */
interface DetailCache {
  fetchedAttemptId:    string | null;
  fetchedAssignmentId: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 3] Context creation
// ─────────────────────────────────────────────────────────────────────────────

const QuizFeedbackContext = createContext<QuizFeedbackContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// [Section 4] Provider component
// ─────────────────────────────────────────────────────────────────────────────

interface QuizFeedbackProviderProps {
  /** Workspace document ID scoping all BFF queries. */
  children: React.ReactNode;
}

/**
 * QuizFeedbackProvider
 * @description
 *   Wraps the grade-related UI subtree. On mount (when docId is available) it automatically
 *   fires the list-level fetches in parallel. Consumer components read data from context
 *   state directly and never call a fetch for list data themselves. Per-click detail fetches
 *   are available as imperative methods and are cached by ID so that returning to a
 *   previously-opened detail view costs zero network round-trips.
 */
export function QuizFeedbackProvider({children }: QuizFeedbackProviderProps) {
  // Step 1: Initialise the reducer.
  const [state, dispatch] = useReducer(quizFeedbackReducer, initialState);
   const { docFileID} = useYDoc();
   const docId = docFileID;

  // Step 2: Ref to track which per-click detail resources have already been fetched.
  //         Using a ref prevents these guard values from causing re-renders.
  const detailCacheRef = useRef<DetailCache>({
    fetchedAttemptId:    null,
    fetchedAssignmentId: null,
  });

  // Step 3: Ref to ensure the one-time list fetches only fire once per provider
  //         lifetime even under React StrictMode (which double-invokes effects in dev).
  const listFetchFiredRef = useRef(false);


  /**
   * lastFetchedDocIdRef
   * @description
   * Tracks the specific document ID that was last successfully targeted for a 
   * list-level fetch. This allows the provider to distinguish between a 
   * React StrictMode double-mount (same ID) and a genuine document switch (new ID).
   */
  const lastFetchedDocIdRef = useRef<string | null>(null);

  // ── One-time list fetch on provider mount ──────────────────────────────────

  /**
   * runListFetches
   * @description
   *   Internal async function called once from the provider's mount effect. Fires
   *   both list-level fetches in parallel using Promise.allSettled so that a failure
   *   in one does not prevent the other from completing. Each result is dispatched
   *   independently; errors are stored in the reducer's error field. A 403 from the
   *   insights endpoint is treated as a silent no-op because scholar accounts will
   *   always receive 403 from that educator-only endpoint — it is not a real error.
   */
  const runListFetches = useCallback(async (docIdArg: string) => {
    // Step 4: Signal loading state before the parallel requests begin.
    dispatch({ type: 'FETCH_START' });
    console.log('QuizFeedbackDataContext [9010] one-time list fetch begin', { docIdArg });

    // Step 5: Fire both list fetches in parallel.
    const [attemptsResult, insightsResult] = await Promise.allSettled([
      quizFeedbackClient.fetchStudentAttempts(docIdArg),
      quizFeedbackClient.fetchQuizInsights(docIdArg),
    ]);

    // Step 6: Dispatch student attempts result.
    if (attemptsResult.status === 'fulfilled') {
      dispatch({ type: 'SET_STUDENT_ATTEMPTS', payload: attemptsResult.value.attempts });
      console.log('QuizFeedbackDataContext [9011] studentAttempts loaded', {
        count: attemptsResult.value.attempts.length,
      });
    } else {
      const msg = attemptsResult.reason instanceof Error
        ? attemptsResult.reason.message
        : 'UNKNOWN_ERROR';
      console.error('QuizFeedbackDataContext [9012] fetchStudentAttempts failed', msg);
      dispatch({ type: 'FETCH_ERROR', payload: msg });
    }

    // Step 7: Dispatch quiz insights result.
    //         403 is expected for scholar accounts — treat as silent no-op.
    if (insightsResult.status === 'fulfilled') {
      dispatch({ type: 'SET_QUIZ_INSIGHTS', payload: insightsResult.value.insights });
      console.log('QuizFeedbackDataContext [9013] quizInsights loaded', {
        count: insightsResult.value.insights.length,
      });
    } else {
      const err   = insightsResult.reason;
      const status = (err as any)?.status;
      if (status === 403) {
        // Step 8: Scholar accounts receive 403 from the educator-only endpoint. Expected.
        console.log('QuizFeedbackDataContext [9014] quizInsights 403 (scholar account, expected)');
      } else {
        const msg = err instanceof Error ? err.message : 'UNKNOWN_ERROR';
        console.error('QuizFeedbackDataContext [9015] fetchQuizInsights failed', msg);
        dispatch({ type: 'FETCH_ERROR', payload: msg });
      }
    }
  }, []);

  // Step 9: Mount effect — fires runListFetches exactly once per provider lifetime.
  //         listFetchFiredRef prevents React StrictMode's double-invocation in dev
  //         from sending duplicate requests to the BFF.
 useEffect(() => {
    // 1. Ensure we have a valid ID and aren't re-fetching the same document twice.
    if (!docId || lastFetchedDocIdRef.current === docId) return;

    // 2. Update the tracking ref to the new ID immediately.
    lastFetchedDocIdRef.current = docId;

    // 3. Clear existing detail caches to prevent cross-document ID collisions.
    detailCacheRef.current = {
      fetchedAttemptId: null,
      fetchedAssignmentId: null,
    };

    // 4. Reset the reducer state so the UI shows loading for the new document.
    dispatch({ type: 'RESET_STATE' });

    // 5. Trigger the network requests for the new document context.
    runListFetches(docId);
  }, [docId, runListFetches]);

  // ── Per-click detail methods ───────────────────────────────────────────────

  /**
   * fetchFeedbackDetail
   * @description
   *   Fetches the per-question correction breakdown for a specific quiz attempt.
   *   Cached by attemptId: if the scholar navigates back to a detail view they have
   *   already opened in this session, the fetch is skipped and the data already held
   *   in the reducer renders immediately. A new attemptId always triggers a fresh fetch.
   *
   * @param docIdArg  - Workspace document ID.
   * @param attemptId - The attempt entry to load feedback for.
   */
  const fetchFeedbackDetail = useCallback(async (
    docIdArg: string,
    attemptId: string,
  ) => {
    // Step 10: Cache hit — same attemptId already loaded in this session.
    if (detailCacheRef.current.fetchedAttemptId === attemptId) {
      console.log('QuizFeedbackDataContext [9020] fetchFeedbackDetail cache hit', { attemptId });
      return;
    }

    // Step 11: Cache miss — fetch from BFF.
    dispatch({ type: 'FETCH_START' });
    try {
      const { detail } = await quizFeedbackClient.fetchFeedbackDetail(docIdArg, attemptId);
      dispatch({ type: 'SET_FEEDBACK_DETAIL', payload: detail });
      // Step 12: Record attemptId so returning to this view skips the fetch.
      detailCacheRef.current.fetchedAttemptId = attemptId;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'UNKNOWN_ERROR';
      console.error('QuizFeedbackDataContext: fetchFeedbackDetail failed', msg);
      dispatch({ type: 'FETCH_ERROR', payload: msg });
      // Step 13: Leave cache null on error so the next attempt retries.
    }
  }, []);

  /**
   * fetchQuizHistogram
   * @description
   *   Fetches the pre-aggregated topic breakdown histogram for a specific assigned quiz.
   *   Cached by assignmentId: drilling into the same quiz histogram a second time within
   *   the same session skips the network call. A new assignmentId always fetches fresh.
   *
   * @param docIdArg     - Workspace document ID.
   * @param assignmentId - The assigned quiz to retrieve the histogram for.
   */
  const fetchQuizHistogram = useCallback(async (
    docIdArg: string,
    assignmentId: string,
  ) => {
    // Step 14: Cache hit — same assignmentId already loaded in this session.
    if (detailCacheRef.current.fetchedAssignmentId === assignmentId) {
      console.log('QuizFeedbackDataContext [9021] fetchQuizHistogram cache hit', { assignmentId });
      return;
    }

    // Step 15: Cache miss — fetch from BFF.
    dispatch({ type: 'FETCH_START' });
    try {
      const { histogram } = await quizFeedbackClient.fetchQuizHistogram(docIdArg, assignmentId);
      dispatch({ type: 'SET_QUIZ_HISTOGRAM', payload: histogram });
      // Step 16: Record assignmentId so returning to this histogram skips the fetch.
      detailCacheRef.current.fetchedAssignmentId = assignmentId;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'UNKNOWN_ERROR';
      console.error('QuizFeedbackDataContext: fetchQuizHistogram failed', msg);
      dispatch({ type: 'FETCH_ERROR', payload: msg });
    }
  }, []);

  // ── Navigation resets ──────────────────────────────────────────────────────

  /**
   * clearFeedbackDetail
   * @description
   *   Resets quizFeedbackDetail to null AND clears the attemptId cache entry.
   *   Only call this on full session reset (e.g. modal close). Do NOT call from a
   *   component unmount effect — that re-introduces the re-fetch loop this
   *   architecture was built to eliminate.
   */
  const clearFeedbackDetail = useCallback(() => {
    detailCacheRef.current.fetchedAttemptId = null;
    dispatch({ type: 'CLEAR_FEEDBACK_DETAIL' });
  }, []);

  /**
   * clearHistogram
   * @description
   *   Resets quizHistogram to null AND clears the assignmentId cache entry.
   *   Same semantics as clearFeedbackDetail — only call on full session reset,
   *   not from a component unmount effect.
   */
  const clearHistogram = useCallback(() => {
    detailCacheRef.current.fetchedAssignmentId = null;
    dispatch({ type: 'CLEAR_HISTOGRAM' });
  }, []);

  // ── No-op stubs for removed list fetch methods ─────────────────────────────
  // These preserve the QuizFeedbackContextValue contract so that any existing
  // consumer call sites compile without changes. They are intentional no-ops —
  // the real fetches have moved into the provider's mount effect above.

  /**
   * fetchStudentAttempts
   * @description
   *   No-op stub. Student attempts are now fetched automatically by the provider on
   *   mount. Consumer components read `studentAttempts` directly from context state.
   *   This stub exists solely to satisfy the context type contract.
   */
  const fetchStudentAttempts = useCallback(async (docIdArg: string) => {
    if (!docIdArg) return;
    await runListFetches(docIdArg);
  }, [runListFetches]);

  /**
   * fetchQuizInsights
   * @description
   *   No-op stub. Quiz insights are now fetched automatically by the provider on
   *   mount. Consumer components read `quizInsights` directly from context state.
   *   This stub exists solely to satisfy the context type contract.
   */
  /**
   * fetchQuizInsights
   * @description
   * Triggers a manual re-fetch of performance insights for educators. This provides 
   * fresh data on average grades and submission counts without a page reload.
   */
  const fetchQuizInsights = useCallback(async (docIdArg: string) => {
    if (!docIdArg) return;
    await runListFetches(docIdArg);
  }, [runListFetches]);

  // Step 17: Assemble the memoized context value.
  const value = useMemo<QuizFeedbackContextValue>(
    () => ({
      studentAttempts:    state.studentAttempts,
      quizFeedbackDetail: state.quizFeedbackDetail,
      quizInsights:       state.quizInsights,
      quizHistogram:      state.quizHistogram,
      fetchStudentAttempts,
      fetchFeedbackDetail,
      fetchQuizInsights,
      fetchQuizHistogram,
      clearFeedbackDetail,
      clearHistogram,
      isLoading: state.isLoading,
      error:     state.error,
    }),
    [
      state,
      fetchStudentAttempts,
      fetchFeedbackDetail,
      fetchQuizInsights,
      fetchQuizHistogram,
      clearFeedbackDetail,
      clearHistogram,
    ],
  );

  return (
    <QuizFeedbackContext.Provider value={value}>
      {children}
    </QuizFeedbackContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 5] Consumer hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useQuizFeedback
 * @description
 *   Custom hook providing access to QuizFeedbackContextValue from any descendant
 *   of QuizFeedbackProvider. Throws a descriptive error if called outside the provider
 *   tree so misconfigured component trees surface clearly in development.
 */
export function useQuizFeedback(): QuizFeedbackContextValue {
  const ctx = useContext(QuizFeedbackContext);
  if (!ctx) {
    throw new Error(
      'useQuizFeedback must be used within a QuizFeedbackProvider. ' +
      'Ensure QuizFeedbackProvider wraps the grades subtree in your layout.',
    );
  }
  return ctx;
}