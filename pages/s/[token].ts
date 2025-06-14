// pages/s/[token].ts

/**
 * @file pages/s/[token].ts
 * @responsibility
 *   • Redeem /s/:token invites (collab & copy).
 *   • On collab: enforce auth, write editors/{uid}, set bm_collab cookie.
 *   • Always redirect to /editor with doc & shareMode.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { redeemToken } from '@/app/src/utils/share/shareToken';

if (!admin.apps.length) admin.initializeApp();
const firestore = admin.firestore();

const COOKIE_NAME = 'bm_collab';
const COOKIE_MAX_AGE = 15 * 60; // 15 minutes

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  const { token } = req.query;
  if (typeof token !== 'string') {
    res.status(400).send('Invalid token');
    return;
  }

  try {
    const invite = await redeemToken(token);

    if (invite.mode === 'collab') {
      // a) Authenticate user
      const session = await authenticateRequest(req, res);
      if (!session) return;
      const uid = session.user.email;

      // b) Grant editor rights
      await firestore
        .collection('documents')
        .doc(invite.resourceId)
        .collection('editors')
        .doc(uid)
        .set({ addedAt: admin.firestore.Timestamp.now() }, { merge: true });

      // c) Issue short-lived JWT
      const payload = { sub: uid, doc: invite.resourceId, roles: ['editor'] };
      const token = jwt.sign(
        payload,
        process.env.SHARE_TOKEN_SECRET!,
        { algorithm: 'HS256', expiresIn: COOKIE_MAX_AGE }
      );

      // d) Set HTTP-only cookie
      res.setHeader('Set-Cookie', serialize(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: COOKIE_MAX_AGE,
        sameSite: 'lax',
      }));
    }

    // Redirect to the editor
    const redirectUrl = `/editor?doc=${encodeURIComponent(invite.resourceId)}&shareMode=${invite.mode}`;
    res.writeHead(302, { Location: redirectUrl });
    res.end();

  } catch (err: any) {
    if (err.message === 'Invite not found' || err.message.includes('not active')) {
      res.status(410).send('Invite no longer valid');
    } else {
      console.error('Redemption error:', err);
      res.status(500).send('Internal Error');
    }
  }
}
