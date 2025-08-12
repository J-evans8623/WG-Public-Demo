/***************************************************************************************
 * @file pages/api/document/bootstrap.ts
 * @description
 *   Authoritative ACL Bootstrap endpoint for Bloom-Maps. This server (BFF) route determines
 *   the caller’s effective permissions for a target document before any bytes are fetched
 *   or collaborative sockets are opened. It validates the NextAuth session, resolves ACL
 *   using Firestore as the single source of truth, and returns a compact snapshot:
 *   { canRead, canEdit, role, publicView, publicEdit, isOwner }. Denied reads respond with
 *   machine-readable codes and correct HTTP statuses so the client can route to an access
 *   screen or downgrade the UI. To minimize accidental caching, responses are marked
 *   `Cache-Control: no-store`. Owners are always write-enabled (fast-path). This version
 *   intentionally omits centralized auditing; only concise console breadcrumbs remain so
 *   developers can trace critical state transitions without leaking sensitive payloads.
 ***************************************************************************************/

import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { resolveAcl } from '@/app/src/utils/resolveAcl';
import { ErrorCode, statusForError } from '@/app/src/types/errorCodes';

type BootstrapOk = {
  docId: string;
  isOwner: boolean;
  role: 'owner' | 'editor' | 'viewer' | null;
  canRead: boolean;
  canEdit: boolean;
  publicView: boolean;
  publicEdit: boolean;
};

type BootstrapErr = { code: ErrorCode; message?: string };

/**
 * @function handler
 * @description
 *   Handles GET /api/document/bootstrap requests by validating the caller’s session and
 *   computing an ACL snapshot for the requested document. The snapshot is the only input
 *   the client needs to decide whether to mount an editor or viewer canvas. Errors are
 *   returned with machine-readable `code` values so upstream UI can react consistently.
 *   All branches set `Cache-Control: no-store` so stale ACL state is not cached between
 *   requests. Purposeful console logs mark key checkpoints for debugging production issues.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BootstrapOk | BootstrapErr>
) {
  // 1) Method & input guard
  if (req.method !== 'GET') {
    console.log('[bootstrap.ts][5101] › Invalid method', req.method);
    res.setHeader('Allow', 'GET');
    res.setHeader('Cache-Control', 'no-store');
    return res
      .status(405)
      .json({ code: ErrorCode.UNAUTHORIZED, message: 'Method not allowed' });
  }

  const docId = String(req.query.docId || '').trim();
  if (!docId) {
    console.log('[bootstrap.ts][5102] › Missing docId');
    res.setHeader('Cache-Control', 'no-store');
    return res
      .status(400)
      .json({ code: ErrorCode.DOC_NOT_FOUND, message: 'Missing docId' });
  }

  // 2) Session
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email?.toLowerCase() || '';
  if (!session || !email) {
    console.log('[bootstrap.ts][5103] › No session or email');
    res.setHeader('Cache-Control', 'no-store');
    return res
      .status(statusForError(ErrorCode.UNAUTHORIZED))
      .json({ code: ErrorCode.UNAUTHORIZED });
  }

  // 3) Resolve ACL
  try {
    console.log('[bootstrap.ts][5104] › Resolving ACL', { docId, email });
    const acl = await resolveAcl(docId, email);

    // Not found
    if (!acl.docExists) {
      console.log('[bootstrap.ts][5105] › Document not found', { docId });
      res.setHeader('Cache-Control', 'no-store');
      return res
        .status(statusForError(ErrorCode.DOC_NOT_FOUND))
        .json({ code: ErrorCode.DOC_NOT_FOUND });
    }

    // Denied read
    if (!acl.canRead) {
      console.log('[bootstrap.ts][5106] › Read denied', { docId, email });
      res.setHeader('Cache-Control', 'no-store');
      return res
        .status(statusForError(ErrorCode.ACL_DENIED_READ))
        .json({ code: ErrorCode.ACL_DENIED_READ });
    }

    // Success
    const payload: BootstrapOk = {
      docId,
      isOwner: acl.isOwner,
      role: acl.role,
      canRead: acl.canRead,
      canEdit: acl.canEdit,
      publicView: acl.publicView,
      publicEdit: acl.publicEdit,
    };

    console.log('[bootstrap.ts][5107] › ACL OK', payload);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(payload);
  } catch (err: any) {
    // Defensive — resolveAcl fails closed; any unexpected error is a 500
    console.error('[bootstrap.ts][5199] › Unexpected error', err);
    res.setHeader('Cache-Control', 'no-store');
    return res
      .status(500)
      .json({ code: ErrorCode.UNAUTHORIZED, message: 'Internal error' });
  }
}
