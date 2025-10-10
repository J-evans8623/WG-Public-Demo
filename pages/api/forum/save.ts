/***************************************************************************************************
 * @file pages/api/forum/save.ts
 * @description
 *   Returns a signed WRITE URL for the forum Y.Doc attached to a given document. The route
 *   authenticates via NextAuth-compatible middleware, authorizes with the existing ACL resolver,
 *   and, for any caller who has access to the base document, mints a v4 signed upload URL for
 *   the canonical forum path. The client is responsible for uploading the encoded Y.Doc bytes
 *   to this URL using HTTP PUT with content-type "application/octet-stream". Concurrency
 *   preconditions are intentionally omitted in v1 to keep the forum feature simple, with a
 *   clear upgrade path later. Time complexity: O(1). Logs capture major checkpoints.
 ***************************************************************************************************/

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { resolveRole } from '@/app/src/services/firebase';
import { signForumUploadUrl } from '@/app/src/services/forum/ForumFb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('pages/api/forum/save.ts [3201] › request', { method: req.method, url: req.url });

  // STEP 1 — Method guard
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.setHeader('Cache-Control', 'no-store');
    console.log('pages/api/forum/save.ts [3202] › methodNotAllowed', { method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // STEP 2 — Auth / session
  const session = await authenticateRequest(req as any, res as any);
  if (!session) {
    console.log('pages/api/forum/save.ts [3203] › noSession');
    return; // authenticateRequest already responded
  }
  const email = session.user?.email?.toLowerCase() || '';
  if (!email) {
    res.setHeader('Cache-Control', 'no-store');
    console.log('pages/api/forum/save.ts [3204] › missingEmail');
    return res.status(401).json({ error: 'No email in session' });
  }

  // STEP 3 — Parse inputs
  const docId = Array.isArray(req.query.doc) ? req.query.doc[0] : req.query.doc;
  if (!docId || typeof docId !== 'string') {
    res.setHeader('Cache-Control', 'no-store');
    console.log('pages/api/forum/save.ts [3205] › badRequestMissingDoc');
    return res.status(400).json({ error: 'Missing doc parameter' });
  }

  try {
    // STEP 4 — ACL check (v1 forum policy: anyone with doc access can save forum)
    const role = await resolveRole(docId, email);
    console.log('pages/api/forum/save.ts [3206] › acl', { docId, email, role });
    if (role === 'None') {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(403).json({ error: 'Access denied' });
    }

    // STEP 5 — Generate signed write URL
    const payload = await signForumUploadUrl(docId);
    res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    console.log('pages/api/forum/save.ts [3207] › ok', { docId, path: payload.path });
    return res.status(200).json(payload);
  } catch (err: any) {
    console.error('pages/api/forum/save.ts [3299] › error', { docId, err: err?.message });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: 'Internal server error' });
  }
}
