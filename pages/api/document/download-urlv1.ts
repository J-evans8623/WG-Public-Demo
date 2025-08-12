/***************************************************************************************
 * @file pages/api/document/download-url.ts
 * @description
 *   Secure, BFF-only endpoint that issues short-lived **download** URLs for Firebase
 *   Storage objects associated with a Bloom-Maps document. This route enforces access
 *   control using the centralized `resolveAcl` helper so that callers must have read
 *   permission (`canRead === true`) or be the document owner before any bytes can be
 *   fetched from Storage. It supports two object “types”: the shared document binary
 *   (`type=doc`) and per-user chat transcripts (`type=chat`). For chat downloads, the
 *   Storage path is namespaced by the authenticated user and the server ensures only
 *   that user can retrieve their own chat blob. Authentication is performed via the
 *   shared `authenticateRequest` utility to keep behavior uniform across the codebase.
 *   All responses are marked `no-store` to prevent caching of security-sensitive state.
 *   Purposeful console logs record major control points with stable 4-digit codes.
 ***************************************************************************************/

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { resolveAcl } from '@/app/src/utils/resolveAcl';
import { ErrorCode, statusForError } from '@/app/src/types/errorCodes';
import { generateDownloadUrl } from '@/app/src/services/firebase';

type Ok = {
  docId: string;
  type: 'doc' | 'chat';
  downloadUrl: string;
  path: string;
  expiresIn: number; // seconds
};

type Err = { code: ErrorCode; message?: string };

/**
 * @function handler
 * @description
 *   Validates session using `authenticateRequest`, validates query params, enforces read
 *   ACL (owner fast-path), and issues a short-lived **read** URL for the requested
 *   resource. Chat downloads are restricted to the caller’s own user-scoped path. All
 *   outcomes use machine-readable error codes. Responses set `Cache-Control: no-store`
 *   to avoid accidental caching of authorization decisions by proxies.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Ok | Err>
) {
  // 1) Method guard
  if (req.method !== 'GET') {
    console.log('[download-url.ts][7101] › Invalid method', req.method);
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
    console.log('[download-url.ts][7102] › Missing/invalid params', { docId, type: typeParam });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ code: ErrorCode.DOC_NOT_FOUND, message: 'Missing docId or type' });
  }

  // 3) Authentication (shared helper responds 401 on failure)
  const session = await authenticateRequest(req, res);
  if (!session) return;
  const email = session.user?.email?.toLowerCase() || '';
  if (!email) {
    console.log('[download-url.ts][7103] › Session has no email');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(statusForError(ErrorCode.UNAUTHORIZED)).json({ code: ErrorCode.UNAUTHORIZED });
  }

  // 4) Resolve ACL (owner fast-path)
  try {
    console.log('[download-url.ts][7104] › Resolving ACL', { docId, email, type });
    const acl = await resolveAcl(docId, email);

    if (!acl.docExists) {
      console.log('[download-url.ts][7105] › Document not found', { docId });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(statusForError(ErrorCode.DOC_NOT_FOUND)).json({ code: ErrorCode.DOC_NOT_FOUND });
    }

    if (!(acl.canRead || acl.isOwner)) {
      console.log('[download-url.ts][7106] › Read denied', { docId, email });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(statusForError(ErrorCode.ACL_DENIED_READ)).json({ code: ErrorCode.ACL_DENIED_READ });
    }

    // 5) Enforce per-user scope for chat downloads
    const userIdForChat = type === 'chat' ? email : undefined;

    // 6) Issue signed URL (TTL ≤ 5 minutes in firebase.ts)
    const { downloadUrl, path } = await generateDownloadUrl(docId, type, userIdForChat);
    console.log('[download-url.ts][7107] › Download URL issued', { docId, type, path });

    res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    return res.status(200).json({
      docId,
      type,
      downloadUrl,
      path,
      expiresIn: 5 * 60,
    });
  } catch (err: any) {
    console.error('[download-url.ts][7199] › Unexpected error', err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ code: ErrorCode.UNAUTHORIZED, message: 'Internal error' });
  }
}
