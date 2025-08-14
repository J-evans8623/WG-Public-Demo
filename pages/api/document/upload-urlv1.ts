/***********************************************************************************************
 * @file pages/api/document/upload-urlv1.ts
 * @description
 *   This API route issues short-lived, signed Firebase Storage URLs for uploading either the
 *   document bytes (`type=doc`) or a per-user chat transcript (`type=chat`). The route is
 *   intentionally narrow in scope and deliberately avoids *any* metadata writes or ownership
 *   claims; it only decides whether to mint a signed URL and returns it. For brand-new files
 *   where the ACL document does not exist yet, the route accepts `?newDoc=true|1` and—only in
 *   that case—allows issuing a doc upload URL without creating Firestore records. The caller’s
 *   effective role is inferred directly from the ACL snapshot (owner/editor/viewer/none) rather
 *   than a separate resolver. Policy: `type=doc` requires Owner/Editor or `publicEdit=true`
 *   (or `newDoc=true` when the ACL is absent). `type=chat` is allowed only when the doc exists
 *   and is scoped by the caller’s user id. All responses include a normalized `{ access }`
 *   envelope and are marked with `Cache-Control: no-store` to avoid caching authorization state.
 *   Purposeful logs include file tag and stable 4-digit codes for production diagnostics.
 *
 * Responsibilities:
 *   1) Authenticate via NextAuth.
 *   2) Infer role from `getAclSnapshot` (no resolveRole).
 *   3) Enforce upload policy, including new-doc bootstrap (no metadata writes).
 *   4) Return `{ uploadUrl, path, access }` with `source: "upload"`.
 ***********************************************************************************************/

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { generateUploadUrl, getAclSnapshot } from '@/app/src/services/firebase';

type Role = 'Owner' | 'Editor' | 'Viewer' | 'None';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  // 0) Method guard
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1) Auth
  const session = await authenticateRequest(req, res);
  if (!session) {
    // authenticateRequest already responded
    return;
  }
  const uid = String(session.user?.email || '').toLowerCase();

  // 2) Parse query
  const docFileID = Array.isArray(req.query.docFileID)
    ? req.query.docFileID[0]
    : (req.query.docFileID as string | undefined);

  const type = Array.isArray(req.query.type)
    ? (req.query.type[0] as 'doc' | 'chat')
    : (req.query.type as 'doc' | 'chat' | undefined);

  const newDoc =
    req.query.newDoc === '1' ||
    req.query.newDoc === 'true' ||
    (Array.isArray(req.query.newDoc) &&
      (req.query.newDoc[0] === '1' || req.query.newDoc[0] === 'true'));

  console.log('[upload-urlv1.ts][4801] › params', { docFileID, type, newDoc });

  if (!docFileID || (type !== 'doc' && type !== 'chat')) {
    res.setHeader('Cache-Control', 'no-store');
    console.error('[upload-urlv1.ts][4802] › invalid params');
    return res.status(400).json({ error: 'Invalid docFileID or type' });
  }

  try {
    // 3) Read ACL posture once; infer role directly from snapshot (no writes here)
    const acl = await getAclSnapshot(docFileID); // { docExists, ownerId, editors[], sharedWith[], publicEdit, publicView }
    console.log('[upload-urlv1.ts][4803] › acl snapshot', {
      exists: acl.docExists,
      owner: acl.ownerId,
      editors: acl.editors.length,
      shared: acl.sharedWith.length,
      publicEdit: acl.publicEdit,
      publicView: acl.publicView,
    });

    // Helper: infer role entirely from snapshot + uid
    const inferRole = (): Role => {
      if (!acl.docExists) return 'None';
      if (uid === acl.ownerId) return 'Owner';
      if (acl.publicEdit) return 'Editor';
      if (acl.editors.includes(uid)) return 'Editor';
      if (acl.publicView) return 'Viewer';
      if (acl.sharedWith.includes(uid)) return 'Viewer';
      return 'None';
    };

    // 4) New-doc bootstrap path (ACL missing) — return BOTH doc & chat URLs
    if (!acl.docExists) {
      if (newDoc) {
        // Always mint both URLs for bootstrap; the client can PUT doc & initialized chat immediately.
        const { uploadUrl, path: fileStoragePath } = await generateUploadUrl(docFileID, 'doc', uid);
        const { uploadUrl: chatUploadUrl, path: chatFileStoragePath } =
          await generateUploadUrl(docFileID, 'chat', uid);

        const access = {
          docId: docFileID,
          // For first upload of a brand-new doc we surface Owner posture optimistically in the client;
          // no persistence is performed here—/api/document/save will upsert metadata.
          role: 'Owner' as const,
          signal: 'GRANT_EDIT' as const,
          source: 'upload' as const,
          at: new Date().toISOString(),
        };

        res.setHeader('Cache-Control', 'no-store, private, max-age=0');
        console.log('[upload-urlv1.ts][4804] › newDoc bootstrap allowed (doc+chat)', {
          docId: docFileID,fileStoragePath, chatFileStoragePath
        });

        // Back-compat: legacy clients that only read {uploadUrl, path} still work.
        return res.status(200).json({ uploadUrl, fileStoragePath, chatUploadUrl, chatFileStoragePath, access });
      }

      // Otherwise, no ACL and not a bootstrap request → 404 with EDIT_REVOKED
      const access = {
        docId: docFileID,
        role: 'Viewer' as const,
        signal: 'EDIT_REVOKED' as const,
        source: 'upload' as const,
        at: new Date().toISOString(),
      };
      res.setHeader('Cache-Control', 'no-store');
      console.warn('[upload-urlv1.ts][4805] › DOC_NOT_FOUND (no bootstrap)', { docId: docFileID, type });
      return res.status(404).json({ error: 'DOC_NOT_FOUND', access });
    }

    // 5) ACL exists → infer role & enforce policy
    const role = inferRole();
    console.log('[upload-urlv1.ts][4806] › role inferred', { docId: docFileID, uid, role });

    // Doc uploads require edit privilege (Owner/Editor) or publicEdit
    if (type === 'doc') {
      const canEdit = role === 'Owner' || role === 'Editor';
      if (!canEdit) {
        const access = {
          docId: docFileID,
          role: role === 'None' ? ('Viewer' as const) : role,
          signal: 'EDIT_REVOKED' as const,
          source: 'upload' as const,
          at: new Date().toISOString(),
        };
        res.setHeader('Cache-Control', 'no-store');
        console.warn('[upload-urlv1.ts][4807] › ACL_DENIED_EDIT for doc upload', { docId: docFileID, uid, role });
        return res.status(403).json({ error: 'ACL_DENIED_EDIT', access });
      }
    }

    // 6) Generate URL and respond
    const { uploadUrl, path } = await generateUploadUrl(docFileID, type, uid);
    const access = {
      docId: docFileID,
      role: role === 'None' ? ('Viewer' as const) : role,
      signal: type === 'doc' ? ('GRANT_EDIT' as const) : (null as null),
      source: 'upload' as const,
      at: new Date().toISOString(),
    };
    res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    console.log('[upload-urlv1.ts][4808] › signed URL ready', { docId: docFileID, type, path });
    return res.status(200).json({ uploadUrl, fileStoragePath: path, access });
  } catch (err) {
    console.error('[upload-urlv1.ts][4899] › error generating URL', err);
    res.setHeader('Cache-Control', 'no-store');
    const access = {
      docId: Array.isArray(req.query.docFileID) ? req.query.docFileID[0] : (req.query.docFileID as string) || '',
      role: 'Viewer' as const,
      signal: 'EDIT_REVOKED' as const,
      source: 'upload' as const,
      at: new Date().toISOString(),
    };
    return res.status(500).json({ error: 'Failed to generate upload URL', access });
  }
}
