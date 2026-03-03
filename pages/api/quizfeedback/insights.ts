/**
 * @file pages/api/quizfeedback/insights.ts
 * @description
 *   BFF endpoint returning the quiz insight summary cards for the Educator Quiz List
 *   (View ③). Access is restricted to users who hold the Owner role on the document
 *   AND have an Educator account type, mirroring the identical gate used by
 *   pages/api/gradebook/index.ts. This prevents scholars from enumerating class-wide
 *   submission statistics. The endpoint delegates all aggregation to
 *   ConsumerAdapter.getQuizInsightSummaries which reads each quiz's pre-aggregated
 *   insight summary sub-document, keeping this handler thin and the response O(A)
 *   where A = number of active assigned quizzes. Quizzes without any feedback-enabled
 *   submissions are included with attemptCount: 0 so the card list is always complete.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { resolveRole } from '@/app/src/services/firebase';
import { UserService } from '@/app/src/services/userService';
import { getQuizInsightSummaries } from '@/app/src/quizFeedback/ConsumerAdapter';
import type { QuizInsightsRes } from '@/app/src/quizFeedback/quizFeedback.types';

// ─────────────────────────────────────────────────────────────────────────────
// [Section 1] Local utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * sendJson
 * @description
 *   Sends a typed JSON response with no-store caching headers. O(1).
 */
function sendJson(res: NextApiResponse, status: number, data: unknown): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.status(status).json(data);
}

/**
 * getQueryDocId
 * @description
 *   Extracts and validates the required ?docId= query parameter. Throws a stable
 *   VALIDATION_ERROR string so the handler can map it to HTTP 400 predictably.
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
 *   GET /api/quizfeedback/insights?docId=...
 *   Returns the array of QuizInsightSummary cards for all active assigned quizzes in the
 *   document. Steps: authenticate → validate docId → enforce Owner + Educator gate →
 *   delegate to ConsumerAdapter → return QuizInsightsRes envelope.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Step 1: Method guard — GET only.
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).end('Method Not Allowed');
    }

    // Step 2: Authenticate the caller.
    const session = await authenticateRequest(req as any, res as any);
    if (!session) {
      console.warn('insights.ts [8321] › unauthorized');
      return sendJson(res, 401, { error: 'UNAUTHORIZED' });
    }

    // Step 3: Validate docId query param.
    let docId = '';
    try {
      docId = getQueryDocId(req);
    } catch (e: any) {
      console.warn('insights.ts [8322] › bad query', { error: e?.message });
      return sendJson(res, 400, { error: 'VALIDATION_ERROR: docId' });
    }

    // Step 4: Authorize — Owner role AND Educator account type required.
    //         Mirrors the identical gate in pages/api/gradebook/index.ts.
    const [role, userProfile] = await Promise.all([
      resolveRole(docId, session.user.email),
      UserService.getUserProfile(session.user.email),
    ]);
    const isEducator = userProfile.accountType === 'educator';

    console.log('insights.ts [8323] › ACL check', { docId, role, isEducator });

    if (role !== 'Owner' || !isEducator) {
      return sendJson(res, 403, { error: 'ACL_DENIED_OWNER_EDUCATOR_REQUIRED' });
    }

    // Step 5: Fetch insight summaries via the ConsumerAdapter.
    const insights = await getQuizInsightSummaries(docId);

    console.log('insights.ts [8324] › GET ok', { docId, count: insights.length });

    // Step 6: Return the typed response envelope.
    const payload: QuizInsightsRes = { insights };
    return sendJson(res, 200, payload);

  } catch (err: any) {
    console.error('insights.ts [8399] › handler error', { error: err?.message });
    return sendJson(res, 500, { error: String(err?.message ?? 'INTERNAL') });
  }
}
