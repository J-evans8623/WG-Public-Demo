/***************************************************************************************************
 * @file pages/api/forum/start.ts
 * @description
 *   Issues an RS256 JWT that authorizes the caller to connect to the forum Yjs room for a given
 *   document. The route authenticates (NextAuth-compatible), authorizes via resolveRole (existing
 *   ACL posture), and, for any user with access to the doc, calls ForumFB.mintForumJwt to return:
 *   { token, role:'editor', expiresIn, room:'forum:<docId>' }. We intentionally do not apply
 *   revocation semantics in v1; short TTL reduces exposure, and the Yjs server remains unchanged.
 *   Time complexity: O(1). Purposeful logs document request lifecycle and outcomes.
 ***************************************************************************************************/

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { resolveRole } from '@/app/src/services/firebase';
import { mintForumJwt } from '@/app/src/services/forum/ForumFb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('pages/api/forum/start.ts [3301] › request', { method: req.method, url: req.url });

  // STEP 1 — Method guard
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.setHeader('Cache-Control', 'no-store');
    console.log('pages/api/forum/start.ts [3302] › methodNotAllowed', { method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // STEP 2 — Auth / session
  const session = await authenticateRequest(req as any, res as any);
  if (!session) {
    console.log('pages/api/forum/start.ts [3303] › noSession');
    return; // authenticateRequest already responded
  }
  const email = session.user?.email?.toLowerCase() || '';
  if (!email) {
    res.setHeader('Cache-Control', 'no-store');
    console.log('pages/api/forum/start.ts [3304] › missingEmail');
    return res.status(401).json({ error: 'No email in session' });
  }

  // STEP 3 — Parse inputs
  const docId = Array.isArray(req.query.doc) ? req.query.doc[0] : req.query.doc;
  if (!docId || typeof docId !== 'string') {
    res.setHeader('Cache-Control', 'no-store');
    console.log('pages/api/forum/start.ts [3305] › badRequestMissingDoc');
    return res.status(400).json({ error: 'Missing doc parameter' });
  }

  try {
    // STEP 4 — ACL check (any access → forum editor)
    const role = await resolveRole(docId, email);
    console.log('pages/api/forum/start.ts [3306] › acl', { docId, email, role });
    if (role === 'None') {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(403).json({ error: 'Access denied' });
    }

    // STEP 5 — Mint JWT for "forum:<docId>"
    const { token, role: issuedRole, expiresIn, room } = await mintForumJwt(docId, email, 15 * 60);
    res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    console.log('pages/api/forum/start.ts [3307] › ok', { docId, issuedRole, expiresIn, room });
    return res.status(200).json({ token, role: issuedRole, expiresIn, room });
  } catch (err: any) {
    console.error('pages/api/forum/start.ts [3399] › error', { docId, err: err?.message });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: 'Internal server error' });
  }
}
