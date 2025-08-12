/***************************************************************************************
 * @file pages/api/document/upload-url.ts
 * @description
 *   Secure, BFF-only endpoint that issues short-lived **upload** URLs for Firebase
 *   Storage. This route **gates writes** with the centralized ACL snapshot, requiring
 *   `canEdit === true` or `isOwner === true` prior to issuance. It supports the shared
 *   document binary (`type=doc`) and per-user chat transcripts (`type=chat`); for chat
 *   uploads, the path is namespaced by the session user and only that user is allowed
 *   to write their blob. Authentication is performed via `authenticateRequest` to keep
 *   behavior consistent across the server code. The generated V4 signed URL binds the
 *   appropriate content type and has a TTL of ≤5 minutes. Responses are `no-store`,
 *   and logs capture key control points for production debugging.
 ***************************************************************************************/

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { resolveAcl } from '@/app/src/utils/resolveAcl';
import { ErrorCode, statusForError } from '@/app/src/types/errorCodes';
import { generateUploadUrl } from '@/app/src/services/firebase';

type Ok = {
  docId: string;
  type: 'doc' | 'chat';
  uploadUrl: string;
  path: string;
  contentType: string;
  expiresIn: number; // seconds
};

type Err = { code: ErrorCode; message?: string };

/**
 * @function handler
 * @description
 *   Validates session via `authenticateRequest`, validates query params, enforces write
 *   ACL (owner or editor / publicEdit), and returns a short-lived **write** URL for
 *   Storage. For `type=chat`, the upload path is constrained to the caller’s namespace
 *   to prevent cross-user writes. Clients should treat returned URLs as single-use by
 *   convention. Errors return machine-readable codes; responses set `no-store`.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  // 1) Method guard
  if (req.method !== 'GET') {
    console.log('[upload-url.ts][7201] › Invalid method', req.method);
    res.setHeader('Allow', 'GET');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ code: ErrorCode.UNAUTHORIZED, message: 'Method not allowed' });
  }

  // 2) Parse & validate input (accept both docId and docFileID for compatibility)
  const rawDocId = (req.query.docId ?? req.query.docFileID) as string | string[] | undefined;
  const docId = (Array.isArray(rawDocId) ? rawDocId[0] : rawDocId)?.trim() || '';
  const typeParam = (req.query.type as string | undefined)?.trim();
  const type = typeParam === 'chat' ? 'chat' : typeParam === 'doc' ? 'doc' : undefined;

  if (!docId || !type) {
    console.log('[upload-url.ts][7202] › Missing/invalid params', { docId, type: typeParam });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ code: ErrorCode.DOC_NOT_FOUND, message: 'Missing docId or type' });
  }

  // 3) Authentication (shared helper responds 401 on failure)
  const session = await authenticateRequest(req, res);
  if (!session) return;
  const email = session.user?.email?.toLowerCase() || '';
  if (!email) {
    console.log('[upload-url.ts][7203] › Session has no email');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(statusForError(ErrorCode.UNAUTHORIZED)).json({ code: ErrorCode.UNAUTHORIZED });
  }

  // 4) Resolve ACL (must be owner or editor / publicEdit)
  try {
    console.log('[upload-url.ts][7204] › Resolving ACL', { docId, email, type });
    const acl = await resolveAcl(docId, email);

    if (!acl.docExists) {
      console.log('[upload-url.ts][7205] › Document not found', { docId });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(statusForError(ErrorCode.DOC_NOT_FOUND)).json({ code: ErrorCode.DOC_NOT_FOUND });
    }

    if (!(acl.canEdit || acl.isOwner)) {
      console.log('[upload-url.ts][7206] › Write denied', { docId, email });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(statusForError(ErrorCode.ACL_DENIED_EDIT)).json({ code: ErrorCode.ACL_DENIED_EDIT });
    }

    // 5) Enforce per-user scope for chat uploads
    const userIdForChat = type === 'chat' ? email : undefined;
    const contentType = type === 'chat' ? 'application/json' : 'application/octet-stream';

    // 6) Issue signed URL (TTL ≤ 5 minutes is set inside firebase.ts)
    const { uploadUrl, path } = await generateUploadUrl(docId, type, userIdForChat);
    console.log('[upload-url.ts][7207] › Upload URL issued', { docId, type, path });

    res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    return res.status(200).json({
      docId,
      type,
      uploadUrl,
      path,
      contentType,
      expiresIn: 5 * 60,
    });
  } catch (err: any) {
    console.error('[upload-url.ts][7299] › Unexpected error', err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ code: ErrorCode.UNAUTHORIZED, message: 'Internal error' });
  }
}
