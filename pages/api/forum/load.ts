/***************************************************************************************************
 * @file pages/api/forum/load.ts
 * @description
 *   Returns a signed READ URL for the forum Y.Doc attached to a given document. The route
 *   authenticates the request via NextAuth-compatible middleware, derives authorization using
 *   the existing ACL resolver (resolveRole), and, if the caller has any access to the doc,
 *   mints a v4 signed URL to read the bytes in Firebase Storage. If the object doesn’t exist,
 *   we return { exists:false, downloadUrl:'', path }. This route performs no writes or Yjs
 *   server operations—its sole purpose is controlled read access to the forum’s persisted state.
 *   Time complexity: O(1); network I/O dominates. Purposeful logs aid diagnostics.
 ***************************************************************************************************/

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { resolveRole } from '@/app/src/services/firebase';
import { signForumDownloadUrl } from '@/app/src/services/forum/ForumFb';
import { withRateLimitNP } from '@/app/src/services/rate-np/withRateLimitNP';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('pages/api/forum/load.ts [3101] › request', { method: req.method, url: req.url });

  // STEP 1 — Method guard
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.setHeader('Cache-Control', 'no-store');
    console.log('pages/api/forum/load.ts [3102] › methodNotAllowed', { method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // STEP 2 — Auth / session
  const session = await authenticateRequest(req as any, res as any);
  if (!session) {
    console.log('pages/api/forum/load.ts [3103] › noSession');
    return; // authenticateRequest already responded
  }
  const email = session.user?.email?.toLowerCase() || '';
  if (!email) {
    res.setHeader('Cache-Control', 'no-store');
    console.log('pages/api/forum/load.ts [3104] › missingEmail');
    return res.status(401).json({ error: 'No email in session' });
  }

  // STEP 3 — Parse inputs
  const docId = Array.isArray(req.query.doc) ? req.query.doc[0] : req.query.doc;
  if (!docId || typeof docId !== 'string') {
    res.setHeader('Cache-Control', 'no-store');
    console.log('pages/api/forum/load.ts [3105] › badRequestMissingDoc');
    return res.status(400).json({ error: 'Missing doc parameter' });
  }

  try {
    // STEP 4 — ACL check (any role other than None is permitted to read forum)
    const role = await resolveRole(docId, email);
    console.log('pages/api/forum/load.ts [3106] › acl', { docId, email, role });
    if (role === 'None') {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(403).json({ error: 'Access denied' });
    }

    // STEP 5 — Generate signed read URL or exists:false
    const payload = await signForumDownloadUrl(docId);
    res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    console.log('pages/api/forum/load.ts [3107] › ok', { docId, exists: payload.exists });
    return res.status(200).json(payload);
  } catch (err: any) {
    console.error('pages/api/forum/load.ts [3199] › error', { docId, err: err?.message });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: 'Internal server error' });
  }
}
export default withRateLimitNP('np:forumData')(handler);