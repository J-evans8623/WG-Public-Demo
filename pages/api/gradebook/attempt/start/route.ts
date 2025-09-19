// app/api/gradebook/attempt/start/route.ts
/***************************************************************************************************
 * @file app/api/gradebook/attempt/start/route.ts
 * @description
 *   Next.js App Router POST endpoint for starting a quiz attempt. Students (Scholars) call this
 *   route with a docId and assignmentId. The server validates the caller’s role (must be a
 *   participant with at least Viewer access on the doc) and their account type (scholar), then
 *   delegates to startAttempt which ensures the time window is open and the attempt limit has not
 *   been exceeded. The handler returns { attemptId, remainingAttempts }. Responses are marked
 *   no-store and include concise, grep-able logs for observability.
 *   Complexity: O(1) HTTP; Firestore write dominates latency.
 *
 * Responsibilities:
 *   1) Authenticate student account (scholar).
 *   2) Enforce role !== None for the given doc (must be in ACL).
 *   3) Delegate to startAttempt and return result.
 ***************************************************************************************************/

import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { resolveRole } from '@/app/src/services/firebase';
import { AttemptStartRes, AttemptStartReq } from '@/app/src/services/gradebook/gradebook.types';
import { startAttempt } from '@/app/src/services/gradebook/gradebookFB';

function json(data: unknown, init?: number): NextResponse {
  return new NextResponse(JSON.stringify(data), {
    status: init ?? 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, private, max-age=0',
    },
  });
}

function validateBody(body: any): asserts body is AttemptStartReq {
  const errors: string[] = [];
  if (!body?.docId || typeof body.docId !== 'string') errors.push('docId');
  if (!body?.assignmentId || typeof body.assignmentId !== 'string') errors.push('assignmentId');
  if (errors.length) throw new Error(`VALIDATION_ERROR: ${errors.join(', ')}`);
}

/**
 * POST
 * Starts a new attempt for the authenticated scholar. Returns attemptId and remainingAttempts.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    // 1) Auth + profile (must be scholar)
    const session = await authenticateRequest({} as any, {} as any);
    if (!session) return json({ error: 'UNAUTHORIZED' }, 401);
    if (session.user.accountType !== 'scholar') {
      return json({ error: 'ACL_DENIED_SCHOLAR_REQUIRED' }, 403);
    }

    // 2) Parse + validate
    const body = await req.json();
    validateBody(body);

    // 3) Role check (must be in ACL: not 'None')
    const role = await resolveRole(body.docId, session.user.email);
    console.log('app/api/gradebook/attempt/start/route.ts [9401] › POST start guard', { docId: body.docId, role });
    if (role === 'None') return json({ error: 'ACL_DENIED' }, 403);

    // 4) Delegate
    const res: AttemptStartRes = await startAttempt(body.docId, session.user.email, body.assignmentId);
    console.log('app/api/gradebook/attempt/start/route.ts [9402] › POST start ok', {
      docId: body.docId,
      assignmentId: body.assignmentId,
      attemptId: res.attemptId,
      remainingAttempts: res.remainingAttempts,
    });
    return json(res, 200);
  } catch (err: any) {
    const msg = String(err?.message ?? 'INTERNAL');
    console.error('app/api/gradebook/attempt/start/route.ts [9499] › POST start error', { err: msg });
    if (msg.startsWith('VALIDATION_')) return json({ error: msg }, 400);
    if (msg === 'WINDOW_NOT_STARTED' || msg === 'WINDOW_CLOSED') return json({ error: msg }, 409);
    if (msg === 'ATTEMPT_LIMIT_REACHED') return json({ error: msg }, 409);
    if (msg === 'ASSIGNMENT_NOT_FOUND') return json({ error: msg }, 404);
    return json({ error: msg || 'INTERNAL' }, 500);
  }
}
