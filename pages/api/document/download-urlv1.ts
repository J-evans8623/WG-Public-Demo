/**
 * @file pages/api/document/download-urlv1.ts
 * @description
 *   Signed-URL generator for client downloads (Phase 3). Always returns a uniform
 *   `{ access }` envelope. Policy:
 *     • Allow if role is Owner/Editor/Viewer OR publicView=true.
 *     • 403 if caller has no read access; include EDIT_REVOKED signal to drive RO UX.
 *   Responses are marked `Cache-Control: no-store`.
 *
 * Responsibilities:
 *   - Authenticate via NextAuth.
 *   - Resolve role and read posture.
 *   - Grant signed URL when readable; include normalized `{ access }`.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { generateDownloadUrl, getAclSnapshot, resolveRole } from '@/app/src/services/firebase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = await authenticateRequest(req, res);
  if (!session) return;

  const docFileID = Array.isArray(req.query.docFileID)
    ? req.query.docFileID[0]
    : req.query.docFileID;
  const type = Array.isArray(req.query.type)
    ? (req.query.type[0] as 'doc' | 'chat')
    : (req.query.type as 'doc' | 'chat');

  console.log('[download-urlv1.ts][4901] › params', { docFileID, type });

  if (!docFileID || (type !== 'doc' && type !== 'chat')) {
    res.setHeader('Cache-Control', 'no-store');
    console.error('[download-urlv1.ts][4902] › invalid params');
    return res.status(400).json({ error: 'Invalid docFileID or type' });
  }

  try {
    const acl = await getAclSnapshot(docFileID);
    if (!acl.docExists) {
      res.setHeader('Cache-Control', 'no-store');
      console.warn('[download-urlv1.ts][4903] › doc not found', { docId: docFileID });
      const access = {
        docId: docFileID,
        role: 'Viewer' as const,
        signal: 'EDIT_REVOKED' as const,
        source: 'download-urlv1' as const,
        at: new Date().toISOString(),
      };
      return res.status(404).json({ error: 'DOC_NOT_FOUND', access });
    }

    const role = await resolveRole(docFileID, session.user.email!);
    const canRead =
      role === 'Owner' || role === 'Editor' || role === 'Viewer' || acl.publicView;

    if (!canRead) {
      res.setHeader('Cache-Control', 'no-store');
      const access = {
        docId: docFileID,
        role: 'Viewer' as const, // drive client to safe RO if previously RW
        signal: 'EDIT_REVOKED' as const,
        source: 'download-urlv1' as const,
        at: new Date().toISOString(),
      };
      console.warn('[download-urlv1.ts][4904] › read denied', { docId: docFileID });
      return res.status(403).json({ error: 'ACL_DENIED_READ', access });
    }

    const userId = session.user.email!;
    const { downloadUrl, path: fileStoragePath } = await generateDownloadUrl(docFileID, type, userId);

    res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    const access = {
      docId: docFileID,
      role: role === 'None' ? ('Viewer' as const) : role,
      signal: null as null,
      source: 'download-urlv1' as const,
      at: new Date().toISOString(),
    };
    console.log('[download-urlv1.ts][4905] › signed URL ready', { docId: docFileID, type });
    return res.status(200).json({ downloadUrl, fileStoragePath, access });
  } catch (err) {
    console.error('[download-urlv1.ts][4999] › error generating URL', err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: 'Failed to generate download URL' });
  }
}
