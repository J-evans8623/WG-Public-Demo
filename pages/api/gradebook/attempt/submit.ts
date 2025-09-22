/***************************************************************************************************
 * @file bloom-maps\pages\api\gradebook\attempt\submit.ts
 * @description
 *   Pages API (Next.js "pages" router) endpoint that submits a previously started quiz attempt
 *   for a Scholar. This file replaces the former App Router route.ts and retains the exact URL
 *   path (/api/gradebook/attempt/submit) and the response contract expected by
 *   gradebookClient.submitAttempt.
 *
 *   Responsibilities and flow:
 *   1) Authenticate the caller and hydrate their profile using authenticateRequest.
 *   2) Enforce Scholar-only access to prevent educators or unaffiliated users from submitting.
 *   3) Validate the incoming payload: docId (string), attemptId (string), scorePct (number).
 *   4) Verify the caller is included in the document ACL (resolveRole !== 'None') before writing.
 *   5) Delegate to submitAttempt, which encapsulates transaction semantics, clamping, and limits.
 *   6) Return a compact JSON result { accepted, remainingAttempts, latestResult } with strict
 *      "no-store" headers for correctness and freshness across the gradebook flows.
 *
 *   Error handling mirrors the legacy behavior for client stability:
 *   - 400 on validation errors; 403 on ACL violations; 404 on missing attempt/assignment;
 *   - 409 on time-window violations or attempt limit breaches; 500 for unexpected errors.
 *
 *   Purposeful logs include a stable 4-digit code to keep observability high and noise low.
 *   Time complexity is O(1) for HTTP orchestration; Firestore transaction dominates latency.
 ***************************************************************************************************/

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { resolveRole } from '@/app/src/services/firebase';
import { submitAttempt } from '@/app/src/services/gradebook/gradebookFB';
import type { AttemptSubmitReq, AttemptSubmitRes } from '@/app/src/services/gradebook/gradebook.types';

/* ──────────────────────────────────────────────────────────────────────────────
 * [Local utilities]
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * sendJson
 * Responsibility:
 *   Send a JSON response with strict "no-store" caching to avoid stale intermediaries.
 *   Centralization guarantees consistent headers on all responses and simplifies auditing.
 *   Complexity: O(1) for header-setting and serialization.
 */
function sendJson(res: NextApiResponse, status: number, data: unknown): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.status(status).json(data);
}

/**
 * methodNotAllowed
 * Responsibility:
 *   Respond with HTTP 405 and an Allow header indicating supported methods. This improves
 *   DX and keeps the API explicit for consumers and test tools. Complexity: O(1).
 */
function methodNotAllowed(res: NextApiResponse, allow: string[]): void {
  res.setHeader('Allow', allow);
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.status(405).end('Method Not Allowed');
}

/**
 * validateBody
 * Responsibility:
 *   Validate the minimal required fields to submit an attempt: docId and attemptId must
 *   be non-empty strings and scorePct must be a finite number. This is a defensive check;
 *   the server-side helper re-validates and clamps as needed. Complexity: O(1).
 */
function validateBody(body: any): asserts body is AttemptSubmitReq {
  const errors: string[] = [];
  if (!body?.docId || typeof body.docId !== 'string') errors.push('docId');
  if (!body?.attemptId || typeof body.attemptId !== 'string') errors.push('attemptId');
  if (typeof body?.scorePct !== 'number' || !Number.isFinite(body.scorePct)) errors.push('scorePct');
  if (errors.length) throw new Error(`VALIDATION_ERROR: ${errors.join(', ')}`);
}

/* ──────────────────────────────────────────────────────────────────────────────
 * [Default handler]
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * handler
 * Responsibility:
 *   Coordinate the "submit attempt" flow for Scholars: authenticate, authorize,
 *   validate input, check ACL membership, delegate to submitAttempt for transactional
 *   persistence, and map known errors to stable HTTP codes. Returns a compact JSON body
 *   that includes acceptance, remainingAttempts, and the latestResult snapshot.
 *   Complexity: O(1) orchestration; Firestore transaction dominates the runtime.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 1) Method guard (POST only).
    if (req.method !== 'POST') {
      console.log('pages/api/gradebook/attempt/submit.ts [7301] › methodNotAllowed', { method: req.method });
      return methodNotAllowed(res, ['POST']);
    }

    // 2) Authenticate the caller (must be logged in).
    const session = await authenticateRequest(req as any, res as any);
    if (!session) {
      console.warn('pages/api/gradebook/attempt/submit.ts [7302] › unauthorized');
      return sendJson(res, 401, { error: 'UNAUTHORIZED' });
    }

    // 3) Enforce Scholar account type.
    if (session.user.accountType !== 'scholar') {
      console.warn('pages/api/gradebook/attempt/submit.ts [7303] › aclDeniedNotScholar', { accountType: session.user.accountType });
      return sendJson(res, 403, { error: 'ACL_DENIED_SCHOLAR_REQUIRED' });
    }

    // 4) Parse and validate body (docId, attemptId, scorePct).
    const body = req.body ?? {};
    validateBody(body);

    // 5) ACL membership check: require role !== 'None'.
    const role = await resolveRole(body.docId, session.user.email);
    console.log('pages/api/gradebook/attempt/submit.ts [7304] › ACL guard', { docId: body.docId, role });
    if (role === 'None') {
      return sendJson(res, 403, { error: 'ACL_DENIED' });
    }

    // 6) Delegate to submitAttempt (transactional; clamps score; enforces limit and window).
    const result: AttemptSubmitRes = await submitAttempt(
      body.docId,
      session.user.email,
      body.attemptId,
      body.scorePct
    );

    console.log('pages/api/gradebook/attempt/submit.ts [7305] › POST submit ok', {
      docId: body.docId,
      attemptId: body.attemptId,
      accepted: result.accepted,
      remainingAttempts: result.remainingAttempts,
    });

    // 7) Respond success.
    return sendJson(res, 200, result);
  } catch (err: any) {
    // 8) Map known errors to stable HTTP codes to preserve client expectations.
    const msg = String(err?.message ?? 'INTERNAL');
    console.error('pages/api/gradebook/attempt/submit.ts [7399] › handler error', { err: msg });

    if (msg.startsWith('VALIDATION_')) return sendJson(res, 400, { error: msg });
    if (msg === 'ATTEMPT_NOT_FOUND') return sendJson(res, 404, { error: msg });
    if (msg === 'ASSIGNMENT_NOT_FOUND') return sendJson(res, 404, { error: msg });
    if (msg === 'WINDOW_NOT_STARTED' || msg === 'WINDOW_CLOSED') return sendJson(res, 409, { error: msg });
    if (msg === 'ATTEMPT_LIMIT_REACHED') return sendJson(res, 409, { error: msg });

    return sendJson(res, 500, { error: msg || 'INTERNAL' });
  }
}
