/**
 * @file pages/api/quizfeedback/student-attempts.ts
 * @description
 *   BFF endpoint that returns the full list of submitted quiz attempts for the
 *   authenticated scholar. This is the data source for the Student Grade List (View ①).
 *   Access is scoped entirely to the requesting user's own data — the session email is
 *   used as the Firestore lookup key, so no student can read another student's attempts.
 *   The only authorization requirement beyond authentication is that the user has any
 *   non-null role in the target document (confirming they have been granted access to
 *   that workspace). Educators can technically call this endpoint but will receive only
 *   their own attempt history, which is typically empty. The handler delegates all
 *   Firestore work to ConsumerAdapter.getStudentAttemptSummaries which returns an
 *   array already sorted descending by submittedAt. HTTP orchestration is O(1);
 *   adapter complexity is O(E + A) where E = student entries, A = unique assignments.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { resolveRole } from '@/app/src/services/firebase';
import { getStudentAttemptSummaries } from '@/app/src/quizFeedback/ConsumerAdapter';
import type { StudentAttemptsRes } from '@/app/src/quizFeedback/quizFeedback.types';

// ─────────────────────────────────────────────────────────────────────────────
// [Section 1] Local utilities (mirrors pattern from gradebook/index.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * sendJson
 * @description
 *   Sends a JSON response with strict no-store caching semantics. Centralised here
 *   so all response branches share consistent headers and serialization. O(1).
 */
function sendJson(res: NextApiResponse, status: number, data: unknown): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.status(status).json(data);
}

/**
 * getQueryDocId
 * @description
 *   Extracts and validates the ?docId= query parameter. Throws VALIDATION_ERROR
 *   with a stable message so the handler maps it to HTTP 400 predictably. O(1).
 */
function getQueryDocId(req: NextApiRequest): string {
  const q = req.query?.docId;
  const docId = Array.isArray(q) ? q[0] : q;
  if (!docId || typeof docId !== 'string') throw new Error('VALIDATION_ERROR: docId');
  return docId;
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 2] Default handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * handler
 * @description
 *   GET /api/quizfeedback/student-attempts?docId=...
 *   Returns all submitted quiz attempts for the authenticated user scoped to the given
 *   document. Steps: authenticate → validate docId → confirm document access via role
 *   check → delegate to ConsumerAdapter → return StudentAttemptsRes envelope.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Step 1: Method guard — GET only.
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).end('Method Not Allowed');
    }

    // Step 2: Authenticate the caller. Unauthenticated requests return 401.
    const session = await authenticateRequest(req as any, res as any);
    if (!session) {
      console.warn('student-attempts.ts [8301] › unauthorized');
      return sendJson(res, 401, { error: 'UNAUTHORIZED' });
    }

    // Step 3: Validate and extract docId from the query string.
    let docId = '';
    try {
      docId = getQueryDocId(req);
    } catch (e: any) {
      console.warn('student-attempts.ts [8302] › bad query', { error: e?.message });
      return sendJson(res, 400, { error: 'VALIDATION_ERROR: docId' });
    }

    // Step 4: Confirm the user has some role in this document. Any non-null role
    //         (Owner, Editor, Viewer) confirms they have been granted workspace access.
    //         This prevents attempts to read attempt data for arbitrary docIds.
    const role = await resolveRole(docId, session.user.email);
    if (!role) {
      console.warn('student-attempts.ts [8303] › no document access', {
        docId, email: session.user.email,
      });
      return sendJson(res, 403, { error: 'ACL_DENIED_NO_DOCUMENT_ACCESS' });
    }

    // Step 5: Delegate to the ConsumerAdapter — scoped to the session user's email.
    const attempts = await getStudentAttemptSummaries(docId, session.user.email);

    console.log('student-attempts.ts [8304] › GET ok', {
      docId,
      email: session.user.email,
      count: attempts.length,
    });

    // Step 6: Return the typed response envelope.
    const payload: StudentAttemptsRes = { attempts };
    return sendJson(res, 200, payload);

  } catch (err: any) {
    console.error('student-attempts.ts [8399] › handler error', { error: err?.message });
    return sendJson(res, 500, { error: String(err?.message ?? 'INTERNAL') });
  }
}
