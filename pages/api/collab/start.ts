/***********************************************************************************************
 * @file pages/api/collab/start.ts
 * @responsibility
 *   ▸ Authenticate the caller (Next-Auth session cookie).
 *   ▸ Authorise access to a document’s live-collaboration channel by checking:
 *       • caller is either the document owner  OR  already in documents/<id>/editors/*
 *   ▸ If the caller is the owner but missing from editors, automatically add them
 *     (keeps ACL & “sharedWith” mirror consistent and prevents owner lock-out).
 *   ▸ Mint a **15-minute** RS256 JWT (sub = caller e-mail, doc = <id>, roles = ['editor'])
 *     that the client will pass to the Yjs WebSocket server via the Sec-WebSocket-Protocol
 *     header.
 *   ▸ Return `{ token, expiresIn }` JSON.
 *
 * NOTE ─ Relies on helpers in `@/app/src/services/firebase`:
 *   • listEditors(docId)  → { owner: string, editors: string[] }
 *   • addEditor(docId, userEmail)
 *
 * Console-log key: pages/api/collab/start.ts 51xx
 **********************************************************************************************/

import type { NextApiRequest, NextApiResponse } from 'next';
import admin            from 'firebase-admin';
import fs               from 'fs';
import path             from 'path';
import jwt              from 'jsonwebtoken';
import { authenticateRequest }   from '@/app/src/auth/authenticateRequest';
import { listEditors, addEditor } from '@/app/src/services/firebase';

// ────────────────────────────────────────────────────────────────────────────
// Firebase bootstrap (idempotent inside Next.js hot reload)
// ────────────────────────────────────────────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp();
  console.log('pages/api/collab/start.ts 5101 › Firebase Admin initialised');
}

// ────────────────────────────────────────────────────────────────────────────
// API Route Handler
// ────────────────────────────────────────────────────────────────────────────
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('pages/api/collab/start.ts 5102 ›', req.method, req.url);

  /* ───  Only GET is supported  ──────────────────────────────────────────── */
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  /* ───  1) Authentication  ─────────────────────────────────────────────── */
  const session = await authenticateRequest(req as any, res as any);
  if (!session) {
    console.log('pages/api/collab/start.ts 5103 › Unauthenticated – 401 sent by helper');
    return;
  }
  const uid = session.user.email ?? 'guest';
  console.log('pages/api/collab/start.ts 5104 › Authenticated as', uid);

  /* ───  2) Validate query string  ───────────────────────────────────────── */
  const docId = Array.isArray(req.query.doc) ? req.query.doc[0] : req.query.doc;
  if (!docId) {
    console.log('pages/api/collab/start.ts 5105 › Missing doc parameter');
    return res.status(400).json({ error: 'Missing doc parameter' });
  }

  /* ───  3) Authorisation (owner OR editor)  ─────────────────────────────── */
  try {
    const { owner, editors } = await listEditors(docId);
    const isOwner  = owner === uid;
    const isEditor = editors.includes(uid);

    if (!isOwner && !isEditor) {
      console.log(
        'pages/api/collab/start.ts 5106 › ACL failed – uid:',
        uid,
        '| owner:',
        owner,
        '| editors:',
        editors
      );
      return res.status(403).json({ error: 'Forbidden' });
    }

    // If the owner is connecting for the first time, add them to editors
    if (isOwner && !isEditor) {
      await addEditor(docId, uid);
      console.log('pages/api/collab/start.ts 5107 › Owner auto-added to editors');
    }
  } catch (err) {
    console.error('pages/api/collab/start.ts 5108 › listEditors error:', err);
    return res.status(500).json({ error: 'ACL check failed' });
  }

  /* ───  4) Load RS256 private key  ──────────────────────────────────────── */
  const rawPath = process.env.JWT_PRIVATE_PATH;
  if (!rawPath) {
    console.error('pages/api/collab/start.ts 5109 › JWT_PRIVATE_PATH not set');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }
  const keyPath = path.isAbsolute(rawPath) ? rawPath : path.join(process.cwd(), rawPath);
  if (!fs.existsSync(keyPath)) {
    console.error('pages/api/collab/start.ts 5110 › Private key missing at', keyPath);
    return res.status(500).json({ error: 'Server misconfiguration' });
  }
  const privateKey = fs.readFileSync(keyPath, 'utf8');

  /* ───  5) Mint token  ──────────────────────────────────────────────────── */
  const expiresIn = 15 * 60; // seconds
  const token = jwt.sign(
    { sub: uid, doc: docId, roles: ['editor'] },
    privateKey,
    { algorithm: 'RS256', expiresIn }
  );
  console.log('pages/api/collab/start.ts 5111 › Minted JWT for', uid, 'doc', docId);

  /* ───  6) Respond  ─────────────────────────────────────────────────────── */
  res.status(200).json({ token, expiresIn });
}
