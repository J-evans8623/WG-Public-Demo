/***************************************************************************************************
 * @file bloom-maps\pages\api\gradebook\attempt\start.ts
 * @description
 *   Pages API (Next.js "pages" router) endpoint that initializes a quiz attempt for a Scholar.
 *   This handler replaces the former App Router route.ts while keeping the exact URL path
 *   (/api/gradebook/attempt/start) and the response shape consumed by gradebookClient.startAttempt.
 *
 *   Responsibilities and flow:
 *   1) Authenticate the caller via authenticateRequest and hydrate the user session.
 *   2) Enforce Scholar-only access; Educator accounts are rejected to prevent misuse.
 *   3) Validate payload defensively (docId and assignmentId must be strings).
 *   4) Verify the caller participates in the document ACL (resolveRole !== 'None').
 *   5) Delegate to startAttempt, which enforces window timing and attempt limit.
 *   6) Return { attemptId, remainingAttempts } with strict "no-store" response headers.
 *
 *   Implementation notes:
 *   - Response mapping mirrors the former route.ts to keep clients stable: 400 for validation
 *     errors, 403 for ACL violations, 404 for missing assignment, and 409 for window/limit issues.
 *   - Purposeful console logs use a stable 4-digit code for grep-ability and low-noise observability.
 *   - Time complexity is O(1) for HTTP orchestration; Firestore operations dominate latency.
 *   - This file adheres to the project’s Pages API pattern: a single default-export handler with
 *     method switching and consistent headers.
 ***************************************************************************************************/

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { resolveRole } from '@/app/src/services/firebase';
import { startAttempt } from '@/app/src/services/gradebook/gradebookFB';
import type { AttemptStartReq, AttemptStartRes } from '@/app/src/services/gradebook/gradebook.types';
import { UserService } from '@/app/src/services/userService';

/* ──────────────────────────────────────────────────────────────────────────────
 * [Local utilities]
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * sendJson
 * Responsibility:
 *   Send a JSON response with strict "no-store" caching for correctness. Centralizing
 *   this ensures all successful and error responses have consistent headers and shape.
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
 *   Respond with a 405 error and an Allow header indicating valid methods. This improves
 *   DX and keeps unsupported requests explicit and predictable. Complexity: O(1).
 */
function methodNotAllowed(res: NextApiResponse, allow: string[]): void {
  res.setHeader('Allow', allow);
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.status(405).end('Method Not Allowed');
}

/**
 * validateBody
 * Responsibility:
 *   Validate the minimum required fields for starting an attempt: docId and assignmentId
 *   must be non-empty strings. This is defensive validation; server logic re-validates.
 *   A stable error prefix enables the handler to map the error to HTTP 400. O(1).
 */
function validateBody(body: any): asserts body is AttemptStartReq {
  const errors: string[] = [];
  if (!body?.docId || typeof body.docId !== 'string') errors.push('docId');
  if (!body?.assignmentId || typeof body.assignmentId !== 'string') errors.push('assignmentId');
  if (errors.length) throw new Error(`VALIDATION_ERROR: ${errors.join(', ')}`);
}

/* ──────────────────────────────────────────────────────────────────────────────
 * [Default handler]
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * handler
 * Responsibility:
 *   Orchestrate the "start attempt" flow for Scholars. It authenticates the caller,
 *   validates payload, enforces ACL membership, then delegates to startAttempt to ensure
 *   time-window and attempt-limit rules. Returns a compact JSON result with consistent
 *   headers and stable error handling to keep the client integration deterministic.
 *   Complexity: O(1) orchestration; storage/network dominate.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 1) Method guard (POST only).
    if (req.method !== 'POST') {
      console.log('pages/api/gradebook/attempt/start.ts [7201] › methodNotAllowed', { method: req.method });
      return methodNotAllowed(res, ['POST']);
    }

    // 2) Authenticate the caller (must be logged in).
    const session = await authenticateRequest(req as any, res as any);
    
    if (!session) {
      console.warn('pages/api/gradebook/attempt/start.ts [7202] › unauthorized');
      return sendJson(res, 401, { error: 'UNAUTHORIZED' });
    }
    const userProfile = await UserService.getUserProfile(session.user.email);

    // 3) Enforce Scholar account type.
    if (userProfile.accountType !== 'scholar') {
      console.warn('pages/api/gradebook/attempt/start.ts [7203] › aclDeniedNotScholar', { accountType: userProfile.accountType });
      return sendJson(res, 403, { error: 'ACL_DENIED_SCHOLAR_REQUIRED' });
    }

    // 4) Parse and validate body (docId, assignmentId).
    const body = req.body ?? {};
    validateBody(body);

    // 5) ACL membership check: require role !== 'None'.
    const role = await resolveRole(body.docId, session.user.email);
    console.log('pages/api/gradebook/attempt/start.ts [7204] › ACL guard', { docId: body.docId, role });
    if (role === 'None') {
      return sendJson(res, 403, { error: 'ACL_DENIED' });
    }

    // 6) Delegate to startAttempt (enforces window and limit).
    const result: AttemptStartRes = await startAttempt(body.docId, session.user.email, body.assignmentId);
    console.log('pages/api/gradebook/attempt/start.ts [7205] › POST start ok', {
      docId: body.docId,
      assignmentId: body.assignmentId,
      attemptId: result.attemptId,
      remainingAttempts: result.remainingAttempts,
    });

    // 7) Respond success.
    return sendJson(res, 200, result);
  } catch (err: any) {
    // 8) Map known errors to stable HTTP codes to preserve client expectations.
    const msg = String(err?.message ?? 'INTERNAL');
    console.error('pages/api/gradebook/attempt/start.ts [7299] › handler error', { err: msg });

    if (msg.startsWith('VALIDATION_')) return sendJson(res, 400, { error: msg });
    if (msg === 'WINDOW_NOT_STARTED' || msg === 'WINDOW_CLOSED') return sendJson(res, 409, { error: msg });
    if (msg === 'ATTEMPT_LIMIT_REACHED') return sendJson(res, 409, { error: msg });
    if (msg === 'ASSIGNMENT_NOT_FOUND') return sendJson(res, 404, { error: msg });

    return sendJson(res, 500, { error: msg || 'INTERNAL' });
  }
}
