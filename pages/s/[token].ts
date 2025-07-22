// pages/s/[token].ts

/**
 * @file pages/s/[token].ts
 * @responsibility
 *   • Detect “Mobi” in User-Agent and redirect mobile visitors to a mobile-share page.
 *   • Redeem share tokens entirely on the server.
 *   • For “collab” invites: authenticate the visitor, update Firestore ACL,
 *     mint a short-lived RS256 JWT cookie proving “editor” access to the doc.
 *   • Redirect back into the SPA with ?doc=…&shareMode=…
 *   • Emit 410 or 500 on errors.
 *
 * ENV VARS REQUIRED
 *   JWT_PRIVATE_PATH → relative or absolute path of the PEM-encoded RSA-2048 private key.
 */

import type { GetServerSideProps, NextPage } from 'next';
import fs from 'fs';
import path from 'path';
import { addEditor } from '@/app/src/services/firebase';

const ShareRedeemPage: NextPage = () => null;

export const getServerSideProps: GetServerSideProps = async ({ req, res, params }) => {
  /* ─── Validate the share-token route param ───────────────────────────── */
  const tokenParam = params?.token;
  console.log('pages/s/[token].ts 1001 ▸ tokenParam=', tokenParam);
  if (typeof tokenParam !== 'string') {
    console.log('pages/s/[token].ts 1002 ▸ Invalid token param');
    res.statusCode = 400;
    res.end('Invalid token');
    return { props: {} };
  }

  /* ─── UA-Sniffing: detect mobile per MDN (/Mobi/i) ───────────────────── */
  const ua = req.headers['user-agent'] || '';
  console.log('pages/s/[token].ts 1009 ○ User-Agent:', ua);
  if (/Mobi/i.test(ua)) {
    console.log('pages/s/[token].ts 1010 ○ Mobile UA detected, redirecting to mobile-share');
    res.writeHead(302, { Location: `/studygraph/mobile-share?token=${tokenParam}` });
    res.end();
    return { props: {} };
  }

  try {
    /* ─── Firebase Admin (lazy import keeps bundle small) ───────────────── */
    const admin = (await import('firebase-admin')).default;
    if (!admin.apps.length) admin.initializeApp();
    const firestore = admin.firestore();

    /* ─── Load RSA-2048 private key from disk ───────────────────────────── */
    const rawPath = process.env.JWT_PRIVATE_PATH;
    if (!rawPath) {
      throw new Error('Missing JWT_PRIVATE_PATH env var – cannot sign tokens');
    }
    const privateKeyPath = path.isAbsolute(rawPath)
      ? rawPath
      : path.join(process.cwd(), rawPath);
    if (!fs.existsSync(privateKeyPath)) {
      throw new Error(`Private key not found at ${privateKeyPath}`);
    }
    const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    console.log('pages/s/[token].ts 1003 ▸ Loaded private key:', privateKeyPath);

    /* ─── Dynamic imports – tree-shaken from client bundle ─────────────── */
    const jwt = (await import('jsonwebtoken')).default;
    const { serialize } = await import('cookie');
    const { authenticateRequest } = await import('@/app/src/auth/authenticateRequest');
    const { redeemToken } = await import('@/app/src/utils/share/shareToken');

    /* ─── Redeem the invite supplied in the URL ────────────────────────── */
    const COOKIE_NAME = 'bm_collab';
    const COOKIE_MAX_AGE = 15 * 60; // 15 minutes

    console.log('pages/s/[token].ts 1004 ▸ Redeeming invite token');
    const invite = await redeemToken(tokenParam);

    /* ─── “Collab” invites: auth + ACL + mint cookie ───────────────────── */
    if (invite.mode === 'collab') {
      console.log('pages/s/[token].ts 1005 ▸ Enforcing auth & ACL');
      const session = await authenticateRequest(req as any, res as any);
      if (!session) {
        // authenticateRequest already wrote 401
        return { props: {} };
      }
      const uid = session.user.email || 'guest';

      await addEditor(invite.resourceId, uid);

      const tokenJwt = jwt.sign(
        { sub: uid, doc: invite.resourceId, roles: ['editor'] },
        privateKey,
        {
          algorithm: 'RS256',
          keyid: '2025-06-a', // rotate on next key-roll
          expiresIn: COOKIE_MAX_AGE,
        }
      );
      console.log('pages/s/[token].ts 1006 ▸ Signed RS256 JWT');

      res.setHeader(
        'Set-Cookie',
        serialize(COOKIE_NAME, tokenJwt, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: COOKIE_MAX_AGE,
          sameSite: 'lax',
        })
      );
    }

    /* ─── Always redirect back into the SPA root ───────────────────────── */
    const location = `/studygraph?doc=${encodeURIComponent(
      invite.resourceId
    )}&shareMode=${invite.mode}`;
    console.log('pages/s/[token].ts 1007 ▸ Redirecting to', location);
    res.writeHead(302, { Location: location });
    res.end();
    return { props: {} };

  } catch (err: any) {
    /* ─── Map errors to HTTP codes ─────────────────────────────────────── */
    console.error('pages/s/[token].ts 1008 ▸ Invite redemption error:', err);
    const msg = err?.message ?? '';
    if (msg.includes('not active') || msg.includes('Invite not found')) {
      res.statusCode = 410;
      res.end('Invite no longer valid');
    } else {
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
    return { props: {} };
  }
};

export default ShareRedeemPage;
