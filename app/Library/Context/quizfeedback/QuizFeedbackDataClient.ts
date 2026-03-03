/**
 * @file app/workspace/(studygraph)/services/quizFeedback/QuizFeedbackDataClient.ts
 * @description
 *   Client-side HTTP wrapper for all QuizFeedback BFF endpoints. This file is the
 *   client-side counterpart to gradebookClient.ts and follows an identical design:
 *   a single shared fetch utility enforces no-store headers and credential inclusion,
 *   typed request/response DTOs mirror the BFF contracts, and named functions are
 *   exported through a single `quizFeedbackClient` object for ergonomic consumption.
 *   QuizFeedbackDataContext imports this object and replaces all inline fetch calls
 *   with the methods defined here, keeping the context file free of URL strings and
 *   HTTP concerns. All four consumer GET endpoints are covered. The producer writes
 *   are not included here because they are triggered server-side inside existing BFF
 *   endpoints (assign-meta POST and attempt/submit POST), not from the client directly.
 *   Each method emits a compact, grep-able console log with a stable 4-digit code.
 *   Complexity is O(1) per method; network latency dominates.
 */

import type {
  StudentAttemptsRes,
  FeedbackDetailRes,
  QuizInsightsRes,
  QuizHistogramRes,
} from '@/app/src/quizFeedback/quizFeedback.types';

// ─────────────────────────────────────────────────────────────────────────────
// [Section 1] Shared fetch utility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * fetchNoStore
 * @description
 *   Shared fetch wrapper that enforces strict no-store semantics, includes session
 *   credentials, and parses the JSON response. On non-2xx status it throws an Error
 *   with the server-provided error message when available, matching the error-handling
 *   pattern established in gradebookClient.ts. All QuizFeedback client methods use
 *   this utility exclusively. Complexity: O(1); network cost dominates.
 *
 * @param url  - Fully qualified path string for the BFF endpoint.
 * @param init - Optional RequestInit overrides (method, body, headers).
 * @returns    - Parsed JSON body typed as T.
 */
async function fetchNoStore<T>(url: string, init?: RequestInit): Promise<T> {
  const start = performance.now();

  const merged: RequestInit = {
    method: init?.method ?? 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'Content-Type':  'application/json',
      'Cache-Control': 'no-store',
      ...(init?.headers ?? {}),
    },
    body: init?.body,
  };

  console.log('QuizFeedbackDataClient.ts [8401] › fetch start', { url, method: merged.method });

  const res  = await fetch(url, merged);
  const text = await res.text();

  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    console.error('QuizFeedbackDataClient.ts [8498] › JSON parse error', { url });
    throw new Error('INVALID_JSON_RESPONSE');
  }

  const ms = Math.round(performance.now() - start);

  if (!res.ok) {
    const message = (data as any)?.error ?? `${res.status} ${res.statusText}`;
    console.warn('QuizFeedbackDataClient.ts [8402] › fetch error', { url, message, ms });
    const err = new Error(message);
    (err as any).status = res.status;
    throw err;
  }

  console.log('QuizFeedbackDataClient.ts [8403] › fetch ok', { url, ms });
  return data as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 2] Consumer API methods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * fetchStudentAttempts
 * @description
 *   Calls GET /api/quizfeedback/student-attempts to load the scholar's submitted attempt
 *   list for a given workspace document. Returns StudentAttemptsRes sorted by submittedAt
 *   descending (sort is guaranteed by the ConsumerAdapter). Throws on non-2xx responses.
 *
 * @param docId - Workspace document ID scoping the query.
 * @returns     - StudentAttemptsRes containing the sorted attempts array.
 */
async function fetchStudentAttempts(docId: string): Promise<StudentAttemptsRes> {
  if (!docId) throw new Error('MISSING_DOC_ID');

  const url = `/api/quizfeedback/student-attempts?docId=${encodeURIComponent(docId)}`;
  const res = await fetchNoStore<StudentAttemptsRes>(url);

  console.log('QuizFeedbackDataClient.ts [8411] › fetchStudentAttempts ok', {
    docId, count: res.attempts?.length ?? 0,
  });
  return res;
}

/**
 * fetchFeedbackDetail
 * @description
 *   Calls GET /api/quizfeedback/feedback-detail to load the full per-question correction
 *   breakdown for a specific attempt. The BFF enforces the quizResultFeedback timing gate —
 *   if the quiz window has not yet closed and the setting is 'after_close', the server
 *   returns 403 FEEDBACK_NOT_YET_AVAILABLE which this method surfaces as a thrown Error.
 *
 * @param docId     - Workspace document ID.
 * @param attemptId - The attempt entry document ID to load feedback for.
 * @returns         - FeedbackDetailRes containing the full correction breakdown.
 */
async function fetchFeedbackDetail(
  docId: string,
  attemptId: string
): Promise<FeedbackDetailRes> {
  if (!docId || !attemptId) throw new Error('MISSING_FIELDS');

  const url = `/api/quizfeedback/feedback-detail?docId=${encodeURIComponent(docId)}&attemptId=${encodeURIComponent(attemptId)}`;
  const res = await fetchNoStore<FeedbackDetailRes>(url);

  console.log('QuizFeedbackDataClient.ts [8421] › fetchFeedbackDetail ok', {
    docId, attemptId, incorrectCount: res.detail?.incorrectCount,
  });
  return res;
}

/**
 * fetchQuizInsights
 * @description
 *   Calls GET /api/quizfeedback/insights to load the educator's quiz insight summary
 *   cards for a given workspace document. The BFF enforces Owner + Educator authorization;
 *   calling this as a non-educator will throw a 403. Returns QuizInsightsRes with the
 *   array sorted most-recent-first (sort guaranteed by ConsumerAdapter).
 *
 * @param docId - Workspace document ID.
 * @returns     - QuizInsightsRes containing the sorted insight summary array.
 */
async function fetchQuizInsights(docId: string): Promise<QuizInsightsRes> {
  if (!docId) throw new Error('MISSING_DOC_ID');

  const url = `/api/quizfeedback/insights?docId=${encodeURIComponent(docId)}`;
  const res = await fetchNoStore<QuizInsightsRes>(url);

  console.log('QuizFeedbackDataClient.ts [8431] › fetchQuizInsights ok', {
    docId, count: res.insights?.length ?? 0,
  });
  return res;
}

/**
 * fetchQuizHistogram
 * @description
 *   Calls GET /api/quizfeedback/histogram to load the pre-aggregated topic breakdown
 *   histogram for a specific assigned quiz. The BFF enforces Owner + Educator authorization
 *   and returns 404 when the insights document does not yet exist (no submissions recorded).
 *   Topics in the response are pre-sorted descending by incorrectCount by the ConsumerAdapter.
 *
 * @param docId        - Workspace document ID.
 * @param assignmentId - The assigned quiz to retrieve the histogram for.
 * @returns            - QuizHistogramRes containing the histogram with sorted topics.
 */
async function fetchQuizHistogram(
  docId: string,
  assignmentId: string
): Promise<QuizHistogramRes> {
  if (!docId || !assignmentId) throw new Error('MISSING_FIELDS');

  const url = `/api/quizfeedback/histogram?docId=${encodeURIComponent(docId)}&assignmentId=${encodeURIComponent(assignmentId)}`;
  const res = await fetchNoStore<QuizHistogramRes>(url);

  console.log('QuizFeedbackDataClient.ts [8441] › fetchQuizHistogram ok', {
    docId, assignmentId, topicCount: res.histogram?.topics?.length ?? 0,
  });
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 3] Exported client object
// ─────────────────────────────────────────────────────────────────────────────

/**
 * quizFeedbackClient
 * @description
 *   Named export object that bundles all four consumer fetch methods. Import this
 *   object in QuizFeedbackDataContext.tsx and call its methods directly. Keeping
 *   all HTTP calls behind this object means URL changes, retry logic, or new headers
 *   only ever need to be updated in this one file.
 */
export const quizFeedbackClient = {
  fetchStudentAttempts,
  fetchFeedbackDetail,
  fetchQuizInsights,
  fetchQuizHistogram,
};
