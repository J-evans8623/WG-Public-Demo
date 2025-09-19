// app/api/gradebook/assign-meta/route.ts
/***************************************************************************************************
 * @file app/api/gradebook/assign-meta/route.ts
 * @description
 *   Next.js App Router endpoint that provides two educator/owner-only operations for the Gradebook:
 *   (1) POST to create or overwrite assigned quiz metadata and (2) PATCH to apply narrow updates
 *   (startAt, endAt, attemptLimit, with optional title). This BFF layer keeps HTTP, auth, and
 *   access control logic separate from Firestore storage semantics implemented in
 *   app/src/server/gradebook/gradebookFB.ts. The route authenticates the caller, enforces “Owner +
 *   Educator” invariants, validates inputs (dates, limits), and then delegates to the helper
 *   functions. Logging is intentionally concise and tagged with a stable 4-digit code, file path,
 *   and key identifiers (docId, assignmentId) to aid troubleshooting without noisy output.
 *   Complexity: O(1) per request; network and Firestore operations dominate overall latency.
 *
 * Responsibilities:
 *   1) Authenticate user and hydrate session profile (accountType).
 *   2) Enforce Owner role (resolveRole) and Educator accountType for writes.
 *   3) Validate payloads and normalize email/ids as needed.
 *   4) Delegate to Firestore helpers (upsert/patch), return JSON, no-store.
 ***************************************************************************************************/

import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { resolveRole } from '@/app/src/services/firebase';
import { upsertAssignedQuizMeta, patchAssignedQuizMeta } from '@/app/src/services/gradebook/gradebookFB';
import { AssignMetaPatchReq, AssignMetaPatchRes, AssignMetaUpsertReq,AssignMetaUpsertRes } from '@/app/src/services/gradebook/gradebook.types';


// ───────────────────────────────────────────────────────────────────────────────
// [Local utilities]
// ───────────────────────────────────────────────────────────────────────────────

/**
 * json
 * Returns a NextResponse JSON with consistent `Cache-Control: no-store` headers.
 * Keeping this helper local avoids repetition and ensures strict no-cache semantics
 * for all Gradebook routes.
 */
function json(data: unknown, init?: number): NextResponse {
  return new NextResponse(JSON.stringify(data), {
    status: init ?? 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, private, max-age=0',
    },
  });
}

/**
 * validateUpsertInput
 * Validates core fields for the POST upsert call: non-empty strings, numeric attemptLimit, and
 * ISO-parsable dates with end > start. This is a defensive guard; Firestore helpers re-validate.
 */
function validateUpsertInput(body: any): asserts body is AssignMetaUpsertReq & { createdBy?: string } {
  const errors: string[] = [];
  if (!body?.docId || typeof body.docId !== 'string') errors.push('docId');
  if (!body?.assignmentId || typeof body.assignmentId !== 'string') errors.push('assignmentId');
  if (!body?.title || typeof body.title !== 'string') errors.push('title');
  if (!body?.startAt || isNaN(new Date(body.startAt).getTime())) errors.push('startAt');
  if (!body?.endAt || isNaN(new Date(body.endAt).getTime())) errors.push('endAt');
  if (typeof body?.attemptLimit !== 'number' || !Number.isFinite(body.attemptLimit) || body.attemptLimit < 1) errors.push('attemptLimit');
  if (errors.length) {
    throw new Error(`VALIDATION_ERROR: ${errors.join(', ')}`);
  }
  if (new Date(body.endAt).getTime() <= new Date(body.startAt).getTime()) {
    throw new Error('VALIDATION_INVALID_WINDOW');
  }
}

/**
 * validatePatchInput
 * Validates PATCH input. Only startAt/endAt/attemptLimit/title are allowed and optional; if dates
 * are present they must be valid ISO strings.
 */
function validatePatchInput(body: any): asserts body is AssignMetaPatchReq {
  const errors: string[] = [];
  if (!body?.docId || typeof body.docId !== 'string') errors.push('docId');
  if (!body?.assignmentId || typeof body.assignmentId !== 'string') errors.push('assignmentId');
  if (body?.startAt && isNaN(new Date(body.startAt).getTime())) errors.push('startAt');
  if (body?.endAt && isNaN(new Date(body.endAt).getTime())) errors.push('endAt');
  if (body?.title && typeof body.title !== 'string') errors.push('title');
  if (body?.attemptLimit != null && (typeof body.attemptLimit !== 'number' || body.attemptLimit < 1)) errors.push('attemptLimit');
  if (errors.length) {
    throw new Error(`VALIDATION_ERROR: ${errors.join(', ')}`);
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// [Route handlers]
// ───────────────────────────────────────────────────────────────────────────────

/**
 * POST
 * Creates or replaces assigned quiz metadata (Owner + Educator only). Minimal validation is applied
 * here; storage logic is handled by gradebookFB.ts. Returns the saved meta in wire shape.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    // 1) Auth + profile
    const session = await authenticateRequest({} as any, {} as any);
    if (!session) return json({ error: 'UNAUTHORIZED' }, 401);
    // 2) Parse body
    const body = await req.json();
    validateUpsertInput(body);
    // 3) Role check (Owner) + accountType (educator)
    const role = await resolveRole(body.docId, session.user.email);
    const isEducator = session.user.accountType === 'educator';
    console.log('app/api/gradebook/assign-meta/route.ts [9101] › POST upsert guard', { docId: body.docId, role, isEducator });
    if (role !== 'Owner' || !isEducator) {
      return json({ error: 'ACL_DENIED_OWNER_EDUCATOR_REQUIRED' }, 403);
    }
    // 4) Delegate to helper
    const saved = await upsertAssignedQuizMeta({ ...body, createdBy: session.user.email });
    console.log('app/api/gradebook/assign-meta/route.ts [9102] › POST upsert ok', { docId: body.docId, assignmentId: body.assignmentId });
    const payload: AssignMetaUpsertRes = { saved };
    return json(payload, 200);
  } catch (err: any) {
    console.error('app/api/gradebook/assign-meta/route.ts [9199] › POST upsert error', { err: String(err?.message ?? err) });
    const msg = String(err?.message ?? 'INTERNAL');
    if (msg.startsWith('VALIDATION_')) return json({ error: msg }, 400);
    if (msg === 'VALIDATION_ERROR') return json({ error: msg }, 400);
    return json({ error: msg || 'INTERNAL' }, 500);
  }
}

/**
 * PATCH
 * Applies a narrow update to an existing assignment (Owner + Educator only). Only startAt/endAt/
 * attemptLimit/title accepted. Returns saved meta in wire shape.
 */
export async function PATCH(req: Request): Promise<NextResponse> {
  try {
    // 1) Auth + profile
    const session = await authenticateRequest({} as any, {} as any);
    if (!session) return json({ error: 'UNAUTHORIZED' }, 401);
    // 2) Parse body
    const body = await req.json();
    validatePatchInput(body);
    // 3) Role + accountType guards
    const role = await resolveRole(body.docId, session.user.email);
    const isEducator = session.user.accountType === 'educator';
    console.log('app/api/gradebook/assign-meta/route.ts [9103] › PATCH guard', { docId: body.docId, role, isEducator });
    if (role !== 'Owner' || !isEducator) {
      return json({ error: 'ACL_DENIED_OWNER_EDUCATOR_REQUIRED' }, 403);
    }
    // 4) Delegate to helper
    const saved = await patchAssignedQuizMeta(body);
    console.log('app/api/gradebook/assign-meta/route.ts [9104] › PATCH ok', { docId: body.docId, assignmentId: body.assignmentId });
    const payload: AssignMetaPatchRes = { saved };
    return json(payload, 200);
  } catch (err: any) {
    console.error('app/api/gradebook/assign-meta/route.ts [9200] › PATCH error', { err: String(err?.message ?? err) });
    const msg = String(err?.message ?? 'INTERNAL');
    if (msg.startsWith('VALIDATION_')) return json({ error: msg }, 400);
    if (msg === 'ASSIGNMENT_NOT_FOUND') return json({ error: msg }, 404);
    return json({ error: msg || 'INTERNAL' }, 500);
  }
}
