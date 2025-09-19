// app/api/gradebook/attempt/submit/route.ts
/***************************************************************************************************
 * @file app/api/gradebook/attempt/submit/route.ts
 * @description
 *   Next.js App Router POST endpoint for submitting an existing attempt with a client-reported
 *   numeric score. The handler validates the caller (scholar), enforces that they have at least
 *   Viewer access on the doc, clamps score on the server via the helper, and relies on the
 *   transactional semantics in submitAttempt for idempotency and limit checking. Returns
 *   { accepted: true, remainingAttempts, latestResult } where latestResult contains the ISO server
 *   timestamp of submission and the stored score. All responses are no-store with concise logs.
 *   Complexity: O(1) HTTP; single Firestore transaction dominates latency.
 *
 * Responsibilities:
 *   1) Authenticate student account (scholar) and verify ACL presence.
 *   2) Validate attemptId and a numeric scorePct in [0..100] (server clamps again).
 *   3) Delegate to submitAttempt and return transaction result.
 ***************************************************************************************************/

import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { resolveRole } from '@/app/src/services/firebase';
import { AttemptSubmitReq, AttemptSubmitRes } from '@/app/src/services/gradebook/gradebook.types';
import { submitAttempt } from '@/app/src/services/gradebook/gradebookFB';

function json(data: unknown, init?: number): NextResponse {
  return new NextResponse(JSON.stringify(data), {
    status: init ?? 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, private, max-age=0',
    },
  });
}

function validateBody(body: any): asserts body is AttemptSubmitReq {
  const errors: string[] = [];
  if (!body?.docId || typeof body.docId !== 'string') errors.push('docId');
  if (!body?.attemptId || typeof body.attemptId !== 'string') errors.push('attemptId');
  if (typeof body?.scorePct !== 'number' || !Number.isFinite(body.scorePct)) errors.push('scorePct');
  if (errors.length) throw new Error(`VALIDATION_ERROR: ${errors.join(', ')}`);
}

/**
 * POST
 * Submits an attempt for the authenticated scholar. Returns { accepted, remainingAttempts, latestResult }.
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
    console.log('app/api/gradebook/attempt/submit/route.ts [9501] › POST submit guard', { docId: body.docId, role });
    if (role === 'None') return json({ error: 'ACL_DENIED' }, 403);

    // 4) Delegate
    const res: AttemptSubmitRes = await submitAttempt(
      body.docId,
      session.user.email,
      body.attemptId,
      body.scorePct
    );
    console.log('app/api/gradebook/attempt/submit/route.ts [9502] › POST submit ok', {
      docId: body.docId,
      attemptId: body.attemptId,
      accepted: res.accepted,
      remainingAttempts: res.remainingAttempts,
    });
    return json(res, 200);
  } catch (err: any) {
    const msg = String(err?.message ?? 'INTERNAL');
    console.error('app/api/gradebook/attempt/submit/route.ts [9599] › POST submit error', { err: msg });
    if (msg.startsWith('VALIDATION_')) return json({ error: msg }, 400);
    if (msg === 'ATTEMPT_NOT_FOUND') return json({ error: msg }, 404);
    if (msg === 'ASSIGNMENT_NOT_FOUND') return json({ error: msg }, 404);
    if (msg === 'WINDOW_NOT_STARTED' || msg === 'WINDOW_CLOSED') return json({ error: msg }, 409);
    if (msg === 'ATTEMPT_LIMIT_REACHED') return json({ error: msg }, 409);
    return json({ error: msg || 'INTERNAL' }, 500);
  }
}
