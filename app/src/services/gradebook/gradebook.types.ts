/***************************************************************************************************
 * @file app/src/server/gradebook/gradebook.types.ts
 * @description
 *   Authoritative, unified TypeScript contracts for the Gradebook feature.
 *   This file standardizes:
 *     1) Identifier and primitive aliases (plain strings for cross-service consistency)
 *     2) Firestore document shapes (…FS with FirebaseFirestore.Timestamp)
 *     3) Wire/API DTOs (ISO-8601 strings, plain string IDs/emails)
 *     4) Aggregation shapes (gradebook snapshot)
 *
 *   Conventions (aligned with other backend modules, e.g., userService):
 *     - Use plain `string` for IDs/emails (no branded types)
 *     - Use `FirebaseFirestore.Timestamp` in `...FS` shapes
 *     - Use ISO `string` timestamps in wire/API shapes
 *     - Postfix `Req` / `Res` for request/response DTOs
 *
 *   No runtime side effects; no imports; safe to tree-shake.
 ***************************************************************************************************/

/* -------------------------------------------------------------------------------------------------
 * 1) Identifier & primitive aliases (plain strings for consistency across backend)
 * ------------------------------------------------------------------------------------------------*/

export type DocId = string;
export type AssignmentId = string;
export type AttemptId = string;
export type EmailString = string;

/** Inclusive time window (ISO-8601 strings) */
export interface WindowISO {
  startAt: string; // e.g., '2025-09-16T09:00:00Z'
  endAt: string;   // e.g., '2025-09-18T23:59:59Z'
}

/** Score invariants (documented here for validators/guards) */
export const SCORE_MIN = 0 as const;
export const SCORE_MAX = 100 as const;

/* -------------------------------------------------------------------------------------------------
 * 2) Firestore schema (server-owned, persisted document shapes)
 *    Paths (per doc):
 *      userFiles/{docId}/assignedQuizzes/{assignmentId}
 *      userFiles/{docId}/attempts/{userEmail}/entries/{attemptId}
 * ------------------------------------------------------------------------------------------------*/

/**
 * Assigned quiz metadata (document under userFiles/{docId}/assignedQuizzes/{assignmentId})
 * - Timestamps are Firestore server timestamps
 */
export interface AssignmentMetaFS {
  assignmentId: AssignmentId;
  title: string;
  startAt: FirebaseFirestore.Timestamp;
  endAt: FirebaseFirestore.Timestamp;
  attemptLimit: number;            // integer >= 1

  // Audit
  createdBy: EmailString;          // normalized email
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

/**
 * Attempt entry (document under userFiles/{docId}/attempts/{email}/entries/{attemptId})
 * - Created on attempt start; submitted exactly once (idempotent submit)
 */
export interface AttemptEntryFS {
  assignmentId: AssignmentId;
  startedAt: FirebaseFirestore.Timestamp;
  submittedAt?: FirebaseFirestore.Timestamp | null;
  scorePct?: number | null;        // 0..100 when submitted
}

/* -------------------------------------------------------------------------------------------------
 * 3) Wire/API shapes (DTOs returned by BFF; ISO strings for timestamps)
 * ------------------------------------------------------------------------------------------------*/

/** Educator-facing assignment metadata (wire shape) */
export interface AssignmentMeta {
  assignmentId: AssignmentId;
  title: string;
  startAt: string;                 // ISO-8601
  endAt: string;                   // ISO-8601
  attemptLimit: number;            // >= 1
  createdBy: EmailString;          // normalized email
  createdAt: string;               // ISO-8601
  updatedAt: string;               // ISO-8601
}

/** Minimal assignment header used by gradebook columns (alias of AssignmentMeta fields) */
export type AssignmentHeader = Pick<
  AssignmentMeta,
  'assignmentId' | 'title' | 'startAt' | 'endAt' | 'attemptLimit'
>;

/** One gradebook cell (latest/highest policy is enforced server-side) */
export interface GradebookCell {
  submittedAt: string;             // ISO-8601 when this result occurred
  scorePct: number;                // 0..100 inclusive
}

/**
 * Gradebook snapshot payload (GET /gradebook):
 *  - students: normalized emails in class (order not guaranteed)
 *  - assignments: header rows (title + window + limit)
 *  - grades: sparse mapping [email][assignmentId] => GradebookCell
 */
export interface GradebookSnapshot {
  students: EmailString[];
  assignments: AssignmentHeader[];
  grades: Record<EmailString, Record<AssignmentId, GradebookCell>>;
}

/* -------------------------------------------------------------------------------------------------
 * 4) BFF endpoint request/response DTOs (Phase 1 contracts)
 *    All handlers respond with JSON and `Cache-Control: no-store`.
 * ------------------------------------------------------------------------------------------------*/

/** POST /api/gradebook/assign-meta */
export interface AssignMetaUpsertReq {
  docId: DocId;
  assignmentId: AssignmentId;
  title: string;
  startAt: string;                 // ISO-8601
  endAt: string;                   // ISO-8601
  attemptLimit: number;            // >= 1
}
export interface AssignMetaUpsertRes {
  saved: AssignmentMeta;
}

/** PATCH /api/gradebook/assign-meta */
export interface AssignMetaPatchReq {
  docId: DocId;
  assignmentId: AssignmentId;
  startAt?: string;                // ISO-8601
  endAt?: string;                  // ISO-8601
  attemptLimit?: number;           // >= 1
  title?: string;
}
export interface AssignMetaPatchRes {
  saved: AssignmentMeta;
}

/** GET /api/gradebook?docId=... */
export interface GradebookQueryReq {
  docId: DocId;
}
export type GradebookQueryRes = GradebookSnapshot;

/** POST /api/gradebook/attempt/start */
export interface AttemptStartReq {
  docId: DocId;
  assignmentId: AssignmentId;
}
export interface AttemptStartRes {
  attemptId: AttemptId;
  remainingAttempts: number;       // >= 0 after this start (submissions count toward limit)
  // If your UX needs it, you may add `window?: WindowISO` in the future; omitted here for stability.
}

/** POST /api/gradebook/attempt/submit */
export interface AttemptSubmitReq {
  docId: DocId;
  attemptId: AttemptId;
  scorePct: number;                // inclusive 0..100 (server will clamp/validate)
  clientMeta?: {                   // optional client hints (non-authoritative)
    userAgent?: string;
    clientTs?: string;             // ISO-8601 client local time
  };
}
export interface AttemptSubmitRes {
  accepted: boolean;               // idempotent OK (true when write accepted or already submitted)
  remainingAttempts: number;
  latestResult: GradebookCell;
}

/* -------------------------------------------------------------------------------------------------
 * 5) Helpers & constants (documentation-only; not used at runtime)
 * ------------------------------------------------------------------------------------------------*/

export const FS_COLLECTIONS = {
  userFiles: 'userFiles',
  assignedQuizzes: 'assignedQuizzes',
  attempts: 'attempts',
  entries: 'entries',
} as const;

/**
 * Canonical Firestore path layout:
 * - Assignment Meta:
 *   userFiles/{docId}/assignedQuizzes/{assignmentId}
 * - Attempt Entries (per user):
 *   userFiles/{docId}/attempts/{userEmail}/entries/{attemptId}
 */
export const FS_PATH_DOCS = `
userFiles/{docId}/assignedQuizzes/{assignmentId}
userFiles/{docId}/attempts/{userEmail}/entries/{attemptId}
`.trim();

/* -------------------------------------------------------------------------------------------------
 * 6) Utility type helpers (non-runtime) to support validators (optional)
 * ------------------------------------------------------------------------------------------------*/

export type NonEmptyString<T extends string = string> = T & { readonly __nonEmpty: true };
export type ISOString = string & { readonly __iso: true };
export type IntString = string & { readonly __int: true };

/* -------------------------------------------------------------------------------------------------
 * 7) Notes on complexity and aggregation policy (informational)
 *    - Attempts remaining: attemptLimit - count(submitted entries). O(N) per user/assignment
 *      where N = attempts for that user on that assignment.
 *    - Latest result policy: pick the entry with max(submittedAt) OR highest score per policy.
 *      O(N) per (user, assignment). In future phases we may pre-aggregate if needed.
 *    - Gradebook snapshot: typically O(U * (A + K)) where U=students, A=assignments, K=avg attempts.
 * ------------------------------------------------------------------------------------------------*/
