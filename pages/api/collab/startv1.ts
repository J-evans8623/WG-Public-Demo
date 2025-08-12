/***********************************************************************************************

@file pages/api/collab/start.ts

@description
Role-aware collaboration token issuer for Bloom-Maps. This API authenticates the caller via
NextAuth, derives the caller’s effective permissions using our centralized resolveAcl
helper, and then mints a short-lived RS256 JWT that encodes { sub, doc, roles }, where
roles is an array containing one of "owner" | "editor" | "viewer".
The token is presented to the Yjs WebSocket server in the Sec-WebSocket-Protocol header.
This endpoint enforces the owner fast-path and supports the three sharing modes in the PRD:
read-only, editor-list, and anyone-can-edit. If the caller lacks read access the request
is denied with a machine-readable error code. Responses are marked no-store and purposeful
logs mark key checkpoints for debugging.

Responsibilities:
- Validate session and input query (doc parameter).
- Resolve ACL snapshot via Firestore (Admin) using resolveAcl.
- Decide the returned role: owner > editor > viewer (readers only); 403 if cannot read.
- Mint an RS256 JWT with a 15-minute expiry and return { token, role, expiresIn }.
- Log success/failure with stable, searchable codes.
***********************************************************************************************/
import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { resolveAcl } from '@/app/src/utils/resolveAcl';
import { ErrorCode, statusForError } from '@/app/src/types/errorCodes';

type Ok = { token: string; role: 'owner' | 'editor' | 'viewer'; expiresIn: number };
type Err = { code: ErrorCode; message?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Ok | Err>) {
  console.log('pages/api/collab/start.ts [5501] ›', req.method, req.url);

  // 1) Method guard
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ code: ErrorCode.UNAUTHORIZED, message: 'Method not allowed' });
  }

  // 2) Auth
  const session = await authenticateRequest(req as any, res as any);
  if (!session) {
    console.log('pages/api/collab/start.ts [5502] › Unauthenticated (helper responded 401)');
    return;
  }
  const email = session.user?.email?.toLowerCase() || '';
  if (!email) {
    console.log('pages/api/collab/start.ts [5503] › Session has no email');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(statusForError(ErrorCode.UNAUTHORIZED)).json({ code: ErrorCode.UNAUTHORIZED });
  }

  // 3) Input guard
  const docId = Array.isArray(req.query.doc) ? req.query.doc[0] : req.query.doc;
  if (!docId || typeof docId !== 'string') {
    console.log('pages/api/collab/start.ts [5504] › Missing doc parameter');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ code: ErrorCode.DOC_NOT_FOUND, message: 'Missing doc parameter' });
  }

  try {
    // 4) ACL (single source of truth)
    console.log('pages/api/collab/start.ts [5505] › Resolving ACL', { docId, email });
    const acl = await resolveAcl(docId, email);

    if (!acl.docExists) {
      console.log('pages/api/collab/start.ts [5506] › Document not found', { docId });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(statusForError(ErrorCode.DOC_NOT_FOUND)).json({ code: ErrorCode.DOC_NOT_FOUND });
    }

    if (!acl.canRead) {
      console.log('pages/api/collab/start.ts [5507] › Read denied', { docId, email });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(statusForError(ErrorCode.ACL_DENIED_READ)).json({ code: ErrorCode.ACL_DENIED_READ });
    }

    // 5) Decide role (owner fast-path → editor if canEdit → viewer otherwise)
    const role: 'owner' | 'editor' | 'viewer' =
      acl.isOwner ? 'owner' : (acl.canEdit ? 'editor' : 'viewer');

    // 6) Load RS256 private key
    const rawPath = process.env.JWT_PRIVATE_PATH;
    if (!rawPath) {
      console.error('pages/api/collab/start.ts [5591] › JWT_PRIVATE_PATH not set');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(500).json({ code: ErrorCode.UNAUTHORIZED, message: 'Server misconfiguration' });
    }
    const keyPath = path.isAbsolute(rawPath) ? rawPath : path.join(process.cwd(), rawPath);
    if (!fs.existsSync(keyPath)) {
      console.error('pages/api/collab/start.ts [5592] › Private key missing at', keyPath);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(500).json({ code: ErrorCode.UNAUTHORIZED, message: 'Server misconfiguration' });
    }
    const privateKey = fs.readFileSync(keyPath, 'utf8');

    // 7) Mint token (NOTE: include roles array; keep role for compatibility)
    const expiresIn = 15 * 60; // seconds
    const roles = [role]; // yjs-server expects payload.roles (array)
    const token = jwt.sign(
      { sub: email, doc: docId, roles, role }, // role kept as legacy
      privateKey,
      { algorithm: 'RS256', expiresIn }
    );

    console.log('pages/api/collab/start.ts [5508] › Minted JWT', { docId, email, role, expSec: expiresIn });
    res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    return res.status(200).json({ token, role, expiresIn });
  } catch (err: any) {
    console.error('pages/api/collab/start.ts [5599] › Unexpected error', err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ code: ErrorCode.UNAUTHORIZED, message: 'Internal error' });
  }
}
