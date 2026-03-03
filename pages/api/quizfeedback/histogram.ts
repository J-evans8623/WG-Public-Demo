/**
 * @file pages/api/quizfeedback/histogram.ts
 * @description
 *   BFF endpoint returning the pre-aggregated topic performance histogram for one
 *   assigned quiz. This is the data source for the Educator Histogram (View ④). Access
 *   is gated identically to insights.ts — Owner role AND Educator account type — since
 *   the histogram reveals class-wide incorrect answer distributions which are sensitive
 *   aggregate statistics that should not be visible to scholars. The endpoint requires
 *   both ?docId= and ?assignmentId= query parameters. It delegates to
 *   ConsumerAdapter.getQuizHistogram which performs a single document read on the
 *   pre-aggregated summary, giving O(1) complexity regardless of how many students
 *   have submitted the quiz. INSIGHTS_NOT_FOUND (no submissions yet) is surfaced as
 *   404 rather than 500 so the UI can show a specific empty state message.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { resolveRole } from '@/app/src/services/firebase';
import { UserService } from '@/app/src/services/userService';
import { getQuizHistogram } from '@/app/src/quizFeedback/ConsumerAdapter';
import type { QuizHistogramRes } from '@/app/src/quizFeedback/quizFeedback.types';

// ─────────────────────────────────────────────────────────────────────────────
// [Section 1] Local utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * sendJson
 * @description
 *   Sends a JSON response with strict no-store caching headers. O(1).
 */
function sendJson(res: NextApiResponse, status: number, data: unknown): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.status(status).json(data);
}

/**
 * getQueryParam
 * @description
 *   Extracts a named query parameter from the request, throwing VALIDATION_ERROR
 *   if absent so the handler can map it to HTTP 400 predictably. O(1).
 */
function getQueryParam(req: NextApiRequest, name: string): string {
  const q = req.query?.[name];
  const val = Array.isArray(q) ? q[0] : q;
  if (!val || typeof val !== 'string') throw new Error(`VALIDATION_ERROR: ${name}`);
  return val;
}

// ─────────────────────────────────────────────────────────────────────────────
// [Section 2] Default handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * handler
 * @description
 *   GET /api/quizfeedback/histogram?docId=...&assignmentId=...
 *   Returns the QuizHistogram with topic-level error breakdown for one quiz. Steps:
 *   authenticate → validate params → enforce Owner + Educator gate →
 *   delegate to ConsumerAdapter → return QuizHistogramRes envelope.
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
      console.warn('histogram.ts [8331] › unauthorized');
      return sendJson(res, 401, { error: 'UNAUTHORIZED' });
    }

    // Step 3: Validate both required query parameters.
    let docId = '';
    let assignmentId = '';
    try {
      docId        = getQueryParam(req, 'docId');
      assignmentId = getQueryParam(req, 'assignmentId');
    } catch (e: any) {
      console.warn('histogram.ts [8332] › bad query', { error: e?.message });
      return sendJson(res, 400, { error: e?.message ?? 'VALIDATION_ERROR' });
    }

    // Step 4: Authorize — Owner role AND Educator account type required.
    const [role, userProfile] = await Promise.all([
      resolveRole(docId, session.user.email),
      UserService.getUserProfile(session.user.email),
    ]);
    const isEducator = userProfile.accountType === 'educator';

    console.log('histogram.ts [8333] › ACL check', { docId, assignmentId, role, isEducator });

    if (role !== 'Owner' || !isEducator) {
      return sendJson(res, 403, { error: 'ACL_DENIED_OWNER_EDUCATOR_REQUIRED' });
    }

    // Step 5: Fetch the histogram from the ConsumerAdapter.
    const histogram = await getQuizHistogram(docId, assignmentId);

    console.log('histogram.ts [8334] › GET ok', {
      docId,
      assignmentId,
      topicCount: histogram.topics.length,
      avgGrade:   histogram.avgGrade,
    });

    // Step 6: Return the typed response envelope.
    const payload: QuizHistogramRes = { histogram };
    return sendJson(res, 200, payload);

  } catch (err: any) {
    const msg = String(err?.message ?? 'INTERNAL');
    console.error('histogram.ts [8399] › handler error', { error: msg });

    // Map known adapter errors to appropriate HTTP codes.
    if (msg === 'ASSIGNMENT_NOT_FOUND') return sendJson(res, 404, { error: msg });
    if (msg === 'INSIGHTS_NOT_FOUND')   return sendJson(res, 404, { error: msg });
    return sendJson(res, 500, { error: msg });
  }
}
