/**
 * @file pages/api/quizfeedback/feedback-detail.ts
 * @description
 *   BFF endpoint returning the full per-question correction breakdown for a single
 *   quiz attempt. This is the data source for the Student Quiz Feedback Detail (View ②).
 *   Beyond authentication and document access, this endpoint enforces the educator-configured
 *   QuizResultFeedback timing gate: if the setting is 'after_close' (the default), the
 *   endpoint returns 403 FEEDBACK_NOT_YET_AVAILABLE until the quiz window's endAt timestamp
 *   has passed. If the setting is 'immediately', the scholar can view their corrections as
 *   soon as the attempt is submitted. The timing check reads the AssignmentMetaFS document
 *   directly in the handler to keep the ConsumerAdapter's getAttemptFeedbackDetail method
 *   free of authorization concerns. HTTP orchestration is O(1); adapter cost is O(1) for
 *   three parallel Firestore reads. The timing check adds one document read (O(1)).
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { resolveRole } from '@/app/src/services/firebase';
import { firestore } from '@/app/src/services/firebase';
import { getAttemptFeedbackDetail } from '@/app/src/quizFeedback/ConsumerAdapter';
import type {
  FeedbackDetailRes,
  QuizResultFeedbackSetting,
  AssignmentMetaFSExtension 
} from '@/app/src/quizFeedback/quizFeedback.types';
import type { AssignmentMetaFS } from '@/app/src/services/gradebook/gradebook.types';

// ─────────────────────────────────────────────────────────────────────────────
// [Section 1] Local utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * sendJson
 * @description
 *   Sends a JSON response with no-store caching. Mirrors the pattern from
 *   gradebook/index.ts for consistency across all BFF endpoints. O(1).
 */
function sendJson(res: NextApiResponse, status: number, data: unknown): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.status(status).json(data);
}

/**
 * getQueryParam
 * @description
 *   Extracts a single named query parameter from the request. Throws VALIDATION_ERROR
 *   if the parameter is absent or not a string, allowing the handler to map it to 400.
 */
function getQueryParam(req: NextApiRequest, name: string): string {
  const q = req.query?.[name];
  const val = Array.isArray(q) ? q[0] : q;
  if (!val || typeof val !== 'string') throw new Error(`VALIDATION_ERROR: ${name}`);
  return val;
}

/**
 * checkFeedbackTimingGate
 * @description
 *   Enforces the QuizResultFeedback timing setting. Reads the AssignmentMetaFS document
 *   for the given assignment and checks whether the current time is past the quiz's endAt.
 *   Returns null if access is permitted, or an error string if it is blocked.
 *   Complexity: O(1) — single Firestore document read.
 *
 * @param docId        - Workspace document ID.
 * @param assignmentId - The assignment to check.
 * @returns null if permitted, error string if blocked.
 */
async function checkFeedbackTimingGate(
  docId: string,
  assignmentId: string
): Promise<string | null> {
  // Step 1: Read the assignment meta document.
  const metaSnap = await firestore
    .collection('userFiles')
    .doc(docId)
    .collection('assignedQuizzes')
    .doc(assignmentId)
    .get();

  if (!metaSnap.exists) return 'ASSIGNMENT_NOT_FOUND';

  const meta = metaSnap.data() as AssignmentMetaFS & AssignmentMetaFSExtension;

  // Step 2: Determine the effective setting — default to 'after_close' when absent
  //         (legacy assignments created before this feature was deployed).
  const setting: QuizResultFeedbackSetting = meta.quizResultFeedback ?? 'after_close';

  // Step 3: If the setting is 'immediately', no timing gate applies.
  if (setting === 'immediately') return null;

  // Step 4: For 'after_close', check whether endAt has passed.
  const endMs = meta.endAt?.toDate()?.getTime() ?? 0;
  const nowMs  = Date.now();

  if (nowMs < endMs) {
    // Step 5: Quiz window is still open — feedback not yet accessible.
    return 'FEEDBACK_NOT_YET_AVAILABLE';
  }

  // Step 6: endAt has passed — feedback is accessible.
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 2] Default handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * handler
 * @description
 *   GET /api/quizfeedback/feedback-detail?docId=...&attemptId=...
 *   Returns the full correction breakdown for one quiz attempt belonging to the
 *   authenticated scholar. Steps: authenticate → validate params → confirm document
 *   access → enforce timing gate → delegate to ConsumerAdapter → return payload.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Step 1: Method guard.
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).end('Method Not Allowed');
    }

    // Step 2: Authenticate.
    const session = await authenticateRequest(req as any, res as any);
    if (!session) {
      console.warn('feedback-detail.ts [8311] › unauthorized');
      return sendJson(res, 401, { error: 'UNAUTHORIZED' });
    }

    // Step 3: Validate query parameters.
    let docId = '';
    let attemptId = '';
    try {
      docId     = getQueryParam(req, 'docId');
      attemptId = getQueryParam(req, 'attemptId');
    } catch (e: any) {
      console.warn('feedback-detail.ts [8312] › bad query', { error: e?.message });
      return sendJson(res, 400, { error: e?.message ?? 'VALIDATION_ERROR' });
    }

    // Step 4: Confirm the user has some role in this document.
    const role = await resolveRole(docId, session.user.email);
    if (!role) {
      console.warn('feedback-detail.ts [8313] › no document access', {
        docId, email: session.user.email,
      });
      return sendJson(res, 403, { error: 'ACL_DENIED_NO_DOCUMENT_ACCESS' });
    }

    // Step 5: Load the feedback detail first to resolve assignmentId, then check timing gate.
    //         We need assignmentId for the timing check but it lives in the feedback document.
    //         To avoid two sequential reads, we load the detail optimistically and gate on
    //         the result's assignmentId. If the gate blocks, we discard the data.
    //         This approach is acceptable because the data is scoped to the session user
    //         (no cross-user data leakage occurs before the gate check).
    const detail = await getAttemptFeedbackDetail(docId, session.user.email, attemptId);

    // Step 6: Enforce the QuizResultFeedback timing gate using the resolved assignmentId.
    const gateError = await checkFeedbackTimingGate(docId, detail.assignmentId);
    if (gateError) {
      console.log('feedback-detail.ts [8314] › timing gate blocked', {
        docId, attemptId, assignmentId: detail.assignmentId, reason: gateError,
      });
      // Map ASSIGNMENT_NOT_FOUND to 404; FEEDBACK_NOT_YET_AVAILABLE to 403.
      const status = gateError === 'ASSIGNMENT_NOT_FOUND' ? 404 : 403;
      return sendJson(res, status, { error: gateError });
    }

    console.log('feedback-detail.ts [8315] › GET ok', {
      docId,
      attemptId,
      assignmentId: detail.assignmentId,
      incorrectCount: detail.incorrectCount,
    });

    // Step 7: Return the typed response envelope.
    const payload: FeedbackDetailRes = { detail };
    return sendJson(res, 200, payload);

  } catch (err: any) {
    const msg = String(err?.message ?? 'INTERNAL');
    console.error('feedback-detail.ts [8399] › handler error', { error: msg });

    // Map known adapter errors to appropriate HTTP codes.
    if (msg === 'FEEDBACK_NOT_FOUND') return sendJson(res, 404, { error: msg });
    if (msg === 'ATTEMPT_NOT_FOUND')  return sendJson(res, 404, { error: msg });
    return sendJson(res, 500, { error: msg });
  }
}
