// app/workspace/(studygraph)/services/gradebookClient.ts

/**
 * @file gradebookClient.ts
 * @description
 *  This module provides a minimal, production-ready API client for the Gradebook feature.
 *  It centralizes HTTP calls to the following BFF endpoints:
 *    1) POST /api/gradebook/assign-meta    → create/replace assignment metadata
 *    2) PATCH /api/gradebook/assign-meta   → patch assignment metadata
 *    3) GET  /api/gradebook?docId=...      → fetch gradebook snapshot (educator/owner only)
 *    4) POST /api/gradebook/attempt/start  → start an attempt (scholar)
 *    5) POST /api/gradebook/attempt/submit → submit an attempt (scholar)
 *
 *  Design Goals:
 *   - Ensure strict "no-store" semantics on all requests for freshness and correctness.
 *   - Normalize all emails to lower-case for consistent keys and equality checks.
 *   - Provide typed request/response DTOs mirroring backend contracts.
 *   - Emit concise, grep-able console logs with a stable 4-digit code per checkpoint
 *     to support debugging while avoiding noisy output.
 *
 *  Error Handling:
 *   - Non-2xx responses throw an Error with a best-effort message from the server’s JSON body.
 *   - JSON parse errors are surfaced as a distinct error to ease detection of BFF regressions.
 *
 *  Complexity:
 *   - Each method is O(1) in the client; network cost dominates.
 *   - Snapshot normalization is O(S + A + E) for the shape merge step, but bounded by the payload.
 *
 *  Responsibilities (Step-by-step):
 *   1) Provide fetchJsonNoStore() utility to enforce headers, credentials and JSON parsing.
 *   2) Define DTOs (request/response) that match the BFF without importing server runtime code.
 *   3) Implement assignMetaUpsert(), assignMetaPatch(), getGradebook(), startAttempt(), submitAttempt().
 *   4) Normalize emails in the gradebook snapshot to lower-case consistently.
 *   5) Export a single gradebookClient with these functions for ergonomic consumption by hooks and UIs.
 */

type DocId = string;
type AssignmentId = string;
type AttemptId = string;
type EmailString = string;
export type AssignmentStatus = 'active' | 'deleted';

/** Inclusive time window (ISO-8601 strings) */
export interface WindowISO {
  startAt: string;
  endAt: string;
}

/** Assignment header used by gradebook columns */
export interface AssignmentHeader {
  assignmentId: AssignmentId;
  title: string;
  startAt: string;    // ISO-8601
  endAt: string;      // ISO-8601
  attemptLimit: number;
  status?: AssignmentStatus;
}

/** Gradebook cell: server currently reports latest/highest policy */
export interface GradebookCell {
  submittedAt: string; // ISO-8601
  scorePct: number;    // 0..100
}

/** Full snapshot returned by GET /api/gradebook */
export interface GradebookSnapshot {
  students: EmailString[];
  assignments: AssignmentHeader[];
  grades: Record<EmailString, Record<AssignmentId, GradebookCell>>;
}

/** POST /api/gradebook/assign-meta */
export interface AssignMetaUpsertReq {
  docId: DocId;
  assignmentId: AssignmentId;
  title: string;
  startAt: string;
  endAt: string;
  attemptLimit: number;
  quizResultFeedback?: 'immediately' | 'after_close';
  lessonTitle?: string;
}
export interface AssignMetaUpsertRes {
  saved: AssignmentHeader & {
    createdBy: EmailString;
    createdAt: string;
    updatedAt: string;
  };
}

/** PATCH /api/gradebook/assign-meta */
export interface AssignMetaPatchReq {
  docId: DocId;
  assignmentId: AssignmentId;
  startAt?: string;
  endAt?: string;
  attemptLimit?: number;
  title?: string;
  quizResultFeedback?: 'immediately' | 'after_close';
}
export interface AssignMetaPatchRes {
  saved: AssignmentHeader & {
    createdBy: EmailString;
    createdAt: string;
    updatedAt: string;
  };
}


/** DELETE /api/gradebook/assign-meta */
export interface AssignMetaDeleteReq {
  docId: DocId;
  assignmentId: AssignmentId;
}
export interface AssignMetaDeleteRes {
  success: boolean;
  assignmentId: string;
}

/** GET /api/gradebook?docId=... */
export type GradebookQueryRes = GradebookSnapshot;

/** POST /api/gradebook/attempt/start */
export interface AttemptStartReq {
  docId: DocId;
  assignmentId: AssignmentId;
}


export interface AttemptStartRes {
  attemptId: AttemptId;
  remainingAttempts: number;
}

/** POST /api/gradebook/attempt/submit */
export interface AttemptSubmitReq {
  docId: DocId;
  attemptId: AttemptId;
  scorePct: number;
  clientMeta?: {
    userAgent?: string;
    clientTs?: string;
  };
  feedbackItems?: Array<{
    questionId: string;
    topicId: string;
    topicLabel: string;
    yourAnswer: string;
  }>;
  totalQuestions?: number;
}
export interface AttemptSubmitRes {
  accepted: boolean;
  remainingAttempts: number;
  latestResult: GradebookCell;
}

/* ------------------------------------------------------------------------------------------------
 * Section: Local helpers
 * ------------------------------------------------------------------------------------------------*/

/**
 * normalizeEmail
 * Responsibility:
 *   Normalize a user email to lower-case, trimming whitespace. This function is used
 *   to create consistent keys in maps and to prevent case-related mismatches when
 *   merging gradebook results. It returns an empty string for falsy inputs gracefully.
 */
function normalizeEmail(email: string | null | undefined): string {
  return String(email || '').trim().toLowerCase();
}

/**
 * isIso
 * Responsibility:
 *   Validate that a string can be parsed as a date. While the server remains the
 *   authority on validation, this avoids obviously malformed inputs leaving the client.
 */
function isIso(value?: string): boolean {
  if (!value) return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

/**
 * fetchJsonNoStore
 * Responsibility:
 *   Perform a fetch with strict "no-store" cache semantics and parse JSON safely.
 *   On HTTP errors, throws an Error with a server-provided message when available.
 *   This utility standardizes headers and credentials across all Gradebook requests.
 */
async function fetchJsonNoStore<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const start = performance.now();
  const merged: RequestInit = {
    method: init?.method || 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(init?.headers || {}),
    },
    body: init?.body,
  };

  console.log('gradebookClient.ts [6101] › fetch start', {
    url: typeof input === 'string' ? input : (input as URL).toString?.(),
    method: merged.method,
  });

  const res = await fetch(input, merged);
  const text = await res.text();

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    console.error('gradebookClient.ts [6198] › JSON parse error', e);
    throw new Error('INVALID_JSON_RESPONSE');
  }

  const ms = Math.round(performance.now() - start);
  if (!res.ok) {
    const message = data?.error || `${res.status} ${res.statusText}`;
    console.warn('gradebookClient.ts [6102] › fetch error', { message, ms });
    const err = new Error(message);
    (err as any).status = res.status;
    throw err;
  }

  console.log('gradebookClient.ts [6103] › fetch ok', { ms });
  return data as T;
}

/* ------------------------------------------------------------------------------------------------
 * Section: Public API
 * ------------------------------------------------------------------------------------------------*/

/**
 * assignMetaUpsert
 * Responsibility:
 *   Create or overwrite assignment metadata on the server. It performs a client-side
 *   sanity check for ISO timestamps and a positive attempt limit before dispatching.
 *   The server remains the final authority; invalid inputs will still be rejected there.
 */
async function assignMetaUpsert(req: AssignMetaUpsertReq): Promise<AssignMetaUpsertRes> {
  if (!req?.docId || !req?.assignmentId || !req?.title) {
    throw new Error('MISSING_FIELDS');
  }
  if (!isIso(req.startAt) || !isIso(req.endAt) || !Number.isFinite(req.attemptLimit) || req.attemptLimit < 1) {
    throw new Error('CLIENT_VALIDATION_ERROR');
  }

  const data = await fetchJsonNoStore<AssignMetaUpsertRes>('/api/gradebook/assign-meta', {
    method: 'POST',
    body: JSON.stringify(req),
  });
  // Normalize email fields in response
  data.saved = {
    ...data.saved,
    createdBy: normalizeEmail(data.saved.createdBy),
  };
  console.log('gradebookClient.ts [6301] › assignMetaUpsert ok', {
    docId: req.docId,
    assignmentId: req.assignmentId,
  });
  return data;
}

/**
 * assignMetaPatch
 * Responsibility:
 *   Patch an existing assignment’s window, limit, or title. Only sends provided fields.
 *   Performs light client validation for ISO timestamps where present.
 */
async function assignMetaPatch(req: AssignMetaPatchReq): Promise<AssignMetaPatchRes> {
  if (!req?.docId || !req?.assignmentId) {
    throw new Error('MISSING_FIELDS');
  }
  if (req.startAt && !isIso(req.startAt)) throw new Error('CLIENT_VALIDATION_ERROR');
  if (req.endAt && !isIso(req.endAt)) throw new Error('CLIENT_VALIDATION_ERROR');
  if (req.attemptLimit != null && (req.attemptLimit < 1 || !Number.isFinite(req.attemptLimit))) {
    throw new Error('CLIENT_VALIDATION_ERROR');
  }

  if (req.quizResultFeedback && req.quizResultFeedback !== 'immediately' && req.quizResultFeedback !== 'after_close') {
    throw new Error('CLIENT_VALIDATION_ERROR: Invalid feedback setting');
  }

  const data = await fetchJsonNoStore<AssignMetaPatchRes>('/api/gradebook/assign-meta', {
    method: 'PATCH',
    body: JSON.stringify(req),
  });
  data.saved = {
    ...data.saved,
    createdBy: normalizeEmail(data.saved.createdBy),
  };
  console.log('gradebookClient.ts [6302] › assignMetaPatch ok', {
    docId: req.docId,
    assignmentId: req.assignmentId,
  });
  return data;
}




/**
 * assignMetaDelete
 * Responsibility:
 * Request a soft-delete of an assignment. Requires Owner permissions on server.
 */
async function assignMetaDelete(req: AssignMetaDeleteReq): Promise<AssignMetaDeleteRes> {
  if (!req?.docId || !req?.assignmentId) {
    throw new Error('MISSING_FIELDS');
  }

  const data = await fetchJsonNoStore<AssignMetaDeleteRes>('/api/gradebook/assign-meta', {
    method: 'DELETE',
    body: JSON.stringify(req),
  });
  
  console.log('gradebookClient.ts [6303] › assignMetaDelete ok', {
    docId: req.docId,
    assignmentId: req.assignmentId,
  });
  return data;
}

/**
 * getGradebook
 * Responsibility:
 *   Fetch the Gradebook snapshot for a document (educator/owner only). The client
 *   normalizes student emails to lower-case and rebuilds the grades map so that
 *   all keys are guaranteed to be normalized on the consumer side.
 */
async function getGradebook(docId: DocId): Promise<GradebookQueryRes> {
  if (!docId) throw new Error('MISSING_DOC_ID');

  const url = new URL('/api/gradebook', window.location.origin);
  url.searchParams.set('docId', docId);

  const res = await fetchJsonNoStore<GradebookQueryRes>(url.toString(), { method: 'GET' });

  // Step 1 — normalize student emails
  const students = res.students.map(normalizeEmail);

  // Step 2 — rebuild grades with normalized keys
  const grades: Record<EmailString, Record<AssignmentId, GradebookCell>> = {};
  for (const [email, cells] of Object.entries(res.grades || {})) {
    const n = normalizeEmail(email);
    grades[n] = {};
    for (const [assignmentId, cell] of Object.entries(cells)) {
      grades[n][assignmentId] = {
        scorePct: Number.isFinite((cell as any).scorePct) ? (cell as any).scorePct : 0,
        submittedAt: (cell as any).submittedAt,
      };
    }
  }

  const out: GradebookQueryRes = {
    students,
    assignments: res.assignments.slice(), // shallow copy for safety
    grades,
  };

  console.log('gradebookClient.ts [6401] › getGradebook ok', {
    docId,
    students: out.students.length,
    assignments: out.assignments.length,
  });
  return out;
}

/**
 * startAttempt
 * Responsibility:
 *   Ask the server to start a new attempt for a given assignment and document. The server
 *   enforces window and limit. This call returns { attemptId, remainingAttempts }.
 */
async function startAttempt(req: AttemptStartReq): Promise<AttemptStartRes> {
  if (!req?.docId || !req?.assignmentId) throw new Error('MISSING_FIELDS');
  const res = await fetchJsonNoStore<AttemptStartRes>('/api/gradebook/attempt/start', {
    method: 'POST',
    body: JSON.stringify(req),
  });
  console.log('gradebookClient.ts [6501] › startAttempt ok', {
    docId: req.docId,
    assignmentId: req.assignmentId,
    attemptId: res.attemptId,
    remainingAttempts: res.remainingAttempts,
  });
  return res;
}

/**
 * submitAttempt
 * Responsibility:
 *   Submit a previously started attempt with the client-computed score. The server
 *   clamps and validates the score and returns { accepted, remainingAttempts, latestResult }.
 */
async function submitAttempt(req: AttemptSubmitReq): Promise<AttemptSubmitRes> {
  if (!req?.docId || !req?.attemptId || !Number.isFinite(req?.scorePct)) {
    throw new Error('MISSING_FIELDS');
  }
  const res = await fetchJsonNoStore<AttemptSubmitRes>('/api/gradebook/attempt/submit', {
    method: 'POST',
    body: JSON.stringify(req),
  });
  console.log('gradebookClient.ts [6601] › submitAttempt ok', {
    docId: req.docId,
    attemptId: req.attemptId,
    accepted: res.accepted,
    remaining: res.remainingAttempts,
  });
  return res;
}

/* ------------------------------------------------------------------------------------------------
 * Section: Exported client
 * ------------------------------------------------------------------------------------------------*/

export const gradebookClient = {
  assignMetaUpsert,
  assignMetaPatch,
  assignMetaDelete,
  getGradebook,
  startAttempt,
  submitAttempt,
};
