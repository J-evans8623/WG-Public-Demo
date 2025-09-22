/***************************************************************************************************
 * @file pages/api/gradebook/assign-meta.ts
 * @description
 *   Pages API (Next.js "pages" router) endpoint that consolidates two educator/owner-only Gradebook
 *   operations under a single default handler. Supported methods:
 *     (1) POST  → Create or overwrite assigned quiz metadata (title, window, attemptLimit)
 *     (2) PATCH → Apply narrow updates to an existing assignment (startAt, endAt, attemptLimit, title)
 *
 *   This file replaces the former App Router route.ts. It preserves the exact URL
 *   (/api/gradebook/assign-meta) and response contracts expected by the existing client
 *   (gradebookClient.assignMetaUpsert / assignMetaPatch), including HTTP status mappings,
 *   structured JSON bodies, strict "no-store" cache headers, and concise, grep-able logs
 *   carrying a stable 4-digit code. The code layers responsibilities explicitly:
 *
 *   1) Authentication and user profile hydration via authenticateRequest.
 *   2) Authorization: Owner role check on the document + Educator account type for writes.
 *   3) Input validation (defensive) for POST and PATCH payloads (ISO parsing, limits).
 *   4) Delegation to Firestore helpers for storage semantics and canonical validation.
 *   5) JSON responses with consistent headers and error mapping for predictable clients.
 *
 *   Time complexity is O(1) per HTTP request; network and Firestore operations dominate latency.
 *   The endpoint uses purposeful logs for observability and avoids noisy or redundant output.
 ***************************************************************************************************/

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { resolveRole } from '@/app/src/services/firebase';
import {
  upsertAssignedQuizMeta,
  patchAssignedQuizMeta,
} from '@/app/src/services/gradebook/gradebookFB';
import type {
  AssignMetaPatchReq,
  AssignMetaPatchRes,
  AssignMetaUpsertReq,
  AssignMetaUpsertRes,
} from '@/app/src/services/gradebook/gradebook.types';

/* ──────────────────────────────────────────────────────────────────────────────
 * [Local utilities]
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * sendJson
 * Responsibility:
 *   Uniformly send a JSON response with strict no-store semantics. This avoids repetition,
 *   guarantees consistent headers across all branches, and makes cache behavior explicit
 *   to intermediaries and browsers to maintain freshest, correct data for gradebook flows.
 *   Complexity: O(1) for header and JSON serialization.
 */
function sendJson(res: NextApiResponse, status: number, data: unknown): void {
  res.setHeader('Content-Type', 'application/json; charset=utf-8'); // update - 1
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');   // update - 2
  res.status(status).json(data);                                    // update - 3
}

/**
 * methodNotAllowed
 * Responsibility:
 *   Provide a consistent 405 response with an Allow header, guiding callers to supported methods.
 *   This improves DX and prevents silent failures, while keeping responses compact and explicit.
 */
function methodNotAllowed(res: NextApiResponse, allow: string[]): void {
  res.setHeader('Allow', allow);                                    // update - 4
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');   // update - 5
  res.status(405).end('Method Not Allowed');                        // update - 6
}

/**
 * validateUpsertInput
 * Responsibility:
 *   Validate core fields for POST upsert: docId, assignmentId, title (string), startAt/endAt
 *   (ISO-parsable), attemptLimit (positive integer), and end > start. This is defensive; the
 *   Firestore layer re-validates. Errors are thrown with stable prefixes for error mapping.
 *   Complexity: O(1).
 */
function validateUpsertInput(body: any): asserts body is AssignMetaUpsertReq & { createdBy?: string } { // update - 7
  const errors: string[] = [];
  if (!body?.docId || typeof body.docId !== 'string') errors.push('docId');
  if (!body?.assignmentId || typeof body.assignmentId !== 'string') errors.push('assignmentId');
  if (!body?.title || typeof body.title !== 'string') errors.push('title');
  if (!body?.startAt || isNaN(new Date(body.startAt).getTime())) errors.push('startAt');
  if (!body?.endAt || isNaN(new Date(body.endAt).getTime())) errors.push('endAt');
  if (typeof body?.attemptLimit !== 'number' || !Number.isFinite(body.attemptLimit) || body.attemptLimit < 1)
    errors.push('attemptLimit');
  if (errors.length) throw new Error(`VALIDATION_ERROR: ${errors.join(', ')}`);
  if (new Date(body.endAt).getTime() <= new Date(body.startAt).getTime()) {
    throw new Error('VALIDATION_INVALID_WINDOW');
  }
}

/**
 * validatePatchInput
 * Responsibility:
 *   Validate PATCH input. Only startAt/endAt/attemptLimit/title are accepted; if present they must
 *   conform to shape (ISO for dates, positive integer for attemptLimit, string for title). Errors
 *   carry a stable prefix so the handler can map them to HTTP 400 predictably. Complexity: O(1).
 */
function validatePatchInput(body: any): asserts body is AssignMetaPatchReq { // update - 8
  const errors: string[] = [];
  if (!body?.docId || typeof body.docId !== 'string') errors.push('docId');
  if (!body?.assignmentId || typeof body.assignmentId !== 'string') errors.push('assignmentId');
  if (body?.startAt && isNaN(new Date(body.startAt).getTime())) errors.push('startAt');
  if (body?.endAt && isNaN(new Date(body.endAt).getTime())) errors.push('endAt');
  if (body?.title && typeof body.title !== 'string') errors.push('title');
  if (body?.attemptLimit != null && (typeof body.attemptLimit !== 'number' || body.attemptLimit < 1))
    errors.push('attemptLimit');
  if (errors.length) throw new Error(`VALIDATION_ERROR: ${errors.join(', ')}`);
}

/* ──────────────────────────────────────────────────────────────────────────────
 * [Default handler: POST | PATCH]
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * handler
 * Responsibility:
 *   Entry point for the Pages API route. It switches on HTTP method and funnels requests
 *   into the appropriate business logic (upsert vs patch). The function centralizes
 *   authentication, authorization, validation, delegation to Firestore helpers, and
 *   JSON error mapping. It emits sparse, stable logs for observability without noise.
 *   Complexity: O(1) HTTP orchestration; Firestore calls dominate overall latency.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) { // update - 9
  try {
    // 1) Route guard by HTTP method (POST | PATCH).                                // update - 10
    if (req.method !== 'POST' && req.method !== 'PATCH') {
      console.log('pages/api/gradebook/assign-meta.ts [7101] › methodNotAllowed', { method: req.method }); // update - 11
      return methodNotAllowed(res, ['POST', 'PATCH']);
    }

    // 2) Authenticate the caller and hydrate session profile.                      // update - 12
    const session = await authenticateRequest(req as any, res as any);
    if (!session) {
      console.warn('pages/api/gradebook/assign-meta.ts [7102] › unauthorized');    // update - 13
      return sendJson(res, 401, { error: 'UNAUTHORIZED' });
    }

    // 3) Parse/validate the body according to method.                              // update - 14
    const body = req.body ?? {};
    if (req.method === 'POST') validateUpsertInput(body);
    if (req.method === 'PATCH') validatePatchInput(body);

    // 4) Authorization: Owner role + Educator account type.                        // update - 15
    const role = await resolveRole(body.docId, session.user.email);
    const isEducator = session.user.accountType === 'educator';
    console.log('pages/api/gradebook/assign-meta.ts [7103] › ACL guard', { docId: body.docId, role, isEducator }); // update - 16
    if (role !== 'Owner' || !isEducator) {
      return sendJson(res, 403, { error: 'ACL_DENIED_OWNER_EDUCATOR_REQUIRED' });
    }

    // 5) Delegate to Firestore helper based on method and return JSON result.      // update - 17
    if (req.method === 'POST') {
      // 5a) Upsert full assigned quiz metadata
      const saved = await upsertAssignedQuizMeta({ ...body, createdBy: session.user.email });
      console.log('pages/api/gradebook/assign-meta.ts [7104] › POST upsert ok', { docId: body.docId, assignmentId: body.assignmentId }); // update - 18
      const payload: AssignMetaUpsertRes = { saved };
      return sendJson(res, 200, payload);
    }

    if (req.method === 'PATCH') {
      // 5b) Patch narrow fields on existing assignment
      const saved = await patchAssignedQuizMeta(body);
      console.log('pages/api/gradebook/assign-meta.ts [7105] › PATCH ok', { docId: body.docId, assignmentId: body.assignmentId }); // update - 19
      const payload: AssignMetaPatchRes = { saved };
      return sendJson(res, 200, payload);
    }

    // Fallback: Should never reach here due to the earlier method guard.           // update - 20
    return methodNotAllowed(res, ['POST', 'PATCH']);
  } catch (err: any) {
    // 6) Error mapping mirrors original behavior to keep the client stable.        // update - 21
    const msg = String(err?.message ?? 'INTERNAL');
    console.error('pages/api/gradebook/assign-meta.ts [7199] › handler error', { err: msg }); // update - 22

    if (msg.startsWith('VALIDATION_') || msg === 'VALIDATION_ERROR') {
      return sendJson(res, 400, { error: msg });
    }
    if (msg === 'ASSIGNMENT_NOT_FOUND') {
      return sendJson(res, 404, { error: msg });
    }
    return sendJson(res, 500, { error: msg || 'INTERNAL' });
  }
}
