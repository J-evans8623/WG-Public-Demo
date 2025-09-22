/***************************************************************************************************
 * @file pages/api/gradebook/index.ts
 * @description
 *   Pages API (Next.js "pages" router) endpoint that returns the Gradebook snapshot for a given
 *   document. This file replaces the former App Router route.ts while keeping the exact URL path
 *   (/api/gradebook?docId=...) and response contract that the existing client expects. The handler
 *   centralizes the orchestration steps for production-grade robustness: (1) authenticate the
 *   caller; (2) authorize access by requiring the document Owner role and Educator account type;
 *   (3) validate the query parameter defensively; (4) delegate to the Firestore helper
 *   getGradebookSnapshot for aggregation; and (5) return a compact JSON body with strict
 *   "no-store" caching headers to prevent stale intermediaries. Purposeful logs include unique
 *   4-digit codes to trace execution checkpoints without being noisy. HTTP orchestration is O(1);
 *   Firestore operations in the helper dominate runtime complexity (typically O(S + A + E)).
 ***************************************************************************************************/

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { resolveRole } from '@/app/src/services/firebase';
import { getGradebookSnapshot } from '@/app/src/services/gradebook/gradebookFB';

/* ──────────────────────────────────────────────────────────────────────────────
 * [Local utilities]
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * sendJson
 * Responsibility:
 *   Send a JSON response with strict "no-store" caching semantics. Centralizing
 *   response writing ensures consistent headers and shapes across success and
 *   error branches, simplifying debugging and client expectations.
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
 *   Emit a 405 with an Allow header that advertises supported methods. This improves
 *   developer experience and keeps misrouted requests explicit and predictable.
 *   Complexity: O(1).
 */
function methodNotAllowed(res: NextApiResponse, allow: string[]): void {
  res.setHeader('Allow', allow);
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.status(405).end('Method Not Allowed');
}

/**
 * getQueryDocId
 * Responsibility:
 *   Extract and validate the docId query parameter from a Pages API request. The function
 *   normalizes the value to a string and enforces presence, throwing a stable error that
 *   the handler maps to HTTP 400. This keeps query parsing concise and predictable.
 *   Complexity: O(1).
 */
function getQueryDocId(req: NextApiRequest): string {
  const q = req.query?.docId;
  const docId = Array.isArray(q) ? q[0] : q;
  if (!docId || typeof docId !== 'string') {
    throw new Error('VALIDATION_ERROR: docId');
  }
  return docId;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * [Default handler]
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * handler
 * Responsibility:
 *   Coordinate the read-only Gradebook snapshot flow. It authenticates the caller,
 *   validates `docId` from the query string, enforces Owner role plus Educator account
 *   type for visibility over student results, delegates to getGradebookSnapshot, and
 *   returns JSON with consistent no-store headers. Known errors are mapped to stable
 *   HTTP codes to keep the client integration deterministic and easy to debug.
 *   Complexity: O(1) orchestration; Firestore reads dominate overall runtime.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 1) Method guard (GET only).
    if (req.method !== 'GET') {
      console.log('pages/api/gradebook/index.ts [7401] › methodNotAllowed', { method: req.method });
      return methodNotAllowed(res, ['GET']);
    }

    // 2) Authenticate the caller.
    const session = await authenticateRequest(req as any, res as any);
    if (!session) {
      console.warn('pages/api/gradebook/index.ts [7402] › unauthorized');
      return sendJson(res, 401, { error: 'UNAUTHORIZED' });
    }

    // 3) Read and validate ?docId=...
    let docId = '';
    try {
      docId = getQueryDocId(req);
    } catch (e: any) {
      console.warn('pages/api/gradebook/index.ts [7403] › badQuery', { error: e?.message || String(e) });
      return sendJson(res, 400, { error: 'VALIDATION_ERROR: docId' });
    }

    // 4) Authorization: must be Owner on the doc and an Educator account.
    const role = await resolveRole(docId, session.user.email);
    const isEducator = session.user.accountType === 'educator';
    console.log('pages/api/gradebook/index.ts [7404] › ACL guard', { docId, role, isEducator });
    if (role !== 'Owner' || !isEducator) {
      return sendJson(res, 403, { error: 'ACL_DENIED_OWNER_EDUCATOR_REQUIRED' });
    }

    // 5) Delegate to Firestore helper to assemble the snapshot.
    const snapshot = await getGradebookSnapshot(docId);
    console.log('pages/api/gradebook/index.ts [7405] › GET snapshot ok', {
      docId,
      students: snapshot.students?.length ?? 0,
      assignments: snapshot.assignments?.length ?? 0,
    });

    // 6) Respond success.
    return sendJson(res, 200, snapshot);
  } catch (err: any) {
    // 7) Unexpected error mapping.
    console.error('pages/api/gradebook/index.ts [7499] › GET snapshot error', { err: String(err?.message ?? err) });
    return sendJson(res, 500, { error: String(err?.message ?? 'INTERNAL') });
  }
}
