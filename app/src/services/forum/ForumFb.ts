/***************************************************************************************************
 * @file app/src/services/forum/ForumFB.ts
 * @description
 *   ForumFB is a tiny, self-contained backend service layer dedicated exclusively to the forum
 *   feature’s persistence and token issuance needs. Its responsibilities are narrow by design:
 *   (1) compute a canonical Storage path for the forum Y.Doc for a given document id; (2) mint
 *   short-lived signed URLs to READ (download) or WRITE (upload) the forum Y.Doc bytes in Firebase
 *   Storage; and (3) issue RS256 JWTs that authorize a client to join a namespaced Yjs room
 *   "forum:<docId>" as an "editor" (anyone who can access the base doc). This isolation ensures the
 *   forum integrates without touching existing document storage code or the main collab system,
 *   thereby minimizing regressions. The service leverages the already-initialized Firebase Admin
 *   singleton (storage bucket), plus standard environment configuration for the JWT private key.
 *   All methods are O(1) with time dominated by network I/O. Observability logs are carefully
 *   placed to expose only the success/failure of major operations without noise.
 *
 * Responsibilities (summary):
 *   • Path computation: documents/{docId}/forum/forum.ydoc (single source of truth)
 *   • Signed URL issuance: v4 read/write links with short expirations
 *   • JWT minting: RS256 tokens with { sub, doc:"forum:<docId>", roles:["editor"] }
 *   • No coupling to frontend; used only by /api/forum/* endpoints
 ***************************************************************************************************/

import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';

/**
 * STEP 1 — Shared bucket handle (O(1)):
 * We rely on the already-initialized Firebase Admin instance in the app.
 * Time complexity: O(1); network I/O occurs when a method uses this bucket.
 */
const bucket = admin.storage().bucket();

/**
 * @function getForumPath
 * @description
 *   Return the canonical Firebase Storage path for the forum Y.Doc for a given document id.
 *   This is the single source of truth for forum storage locations and ensures all callers
 *   use the exact same path convention, eliminating scattered string assembly and reducing
 *   future refactor costs. The function performs simple string construction and validation.
 *   Time complexity: O(1). Throws on invalid input to fail fast and aid debugging.
 */
export function getForumPath(docId: string): string {
  // STEP 2 — Validate input (defense in depth)
  if (!docId || typeof docId !== 'string') {
    throw new Error('ForumFB.getForumPath: invalid docId');
  }
  // STEP 3 — Construct canonical path (O(1))
  const pathStr = `documents/${docId}/forum/forum.ydoc`;
  console.log('ForumFB.ts [2001] › getForumPath', { docId, path: pathStr });
  return pathStr;
}

/**
 * @function signForumDownloadUrl
 * @description
 *   Mint a short-lived, signed v4 READ URL for the forum Y.Doc. If the object does not exist,
 *   returns { exists:false, downloadUrl:'', path }. Callers can branch without extra handling.
 *   Reads object metadata using Admin SDK to check existence, then returns a signed URL if
 *   present. Time complexity: O(1); network latency dominates. All failures surface cleanly.
 */
export async function signForumDownloadUrl(
  docId: string
): Promise<{ downloadUrl: string; path: string; exists: boolean }> {
  // STEP 1 — Resolve canonical path
  const pathStr = getForumPath(docId);

  try {
    // STEP 2 — Check existence (O(1) + network)
    const [exists] = await bucket.file(pathStr).exists();
    console.log('ForumFB.ts [2002] › signForumDownloadUrl.exists', { docId, path: pathStr, exists });

    // STEP 3 — If missing, return exists=false without URL
    if (!exists) {
      return { downloadUrl: '', path: pathStr, exists: false };
    }

    // STEP 4 — Generate v4 signed READ URL (O(1) + network)
    const [downloadUrl] = await bucket.file(pathStr).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

    console.log('ForumFB.ts [2003] › signForumDownloadUrl.ok', { docId, path: pathStr });
    return { downloadUrl, path: pathStr, exists: true };
  } catch (err) {
    console.error('ForumFB.ts [2099] › signForumDownloadUrl.error', { docId, path: pathStr, err });
    throw err;
  }
}

/**
 * @function signForumUploadUrl
 * @description
 *   Mint a short-lived, signed v4 WRITE URL for the forum Y.Doc. The client will upload the
 *   encoded Y.Doc bytes to this URL using PUT with content-type "application/octet-stream".
 *   No concurrency preconditions are enforced in v1 to keep forum simple (future compatible).
 *   Time complexity: O(1); network latency dominates.
 */
export async function signForumUploadUrl(
  docId: string
): Promise<{ uploadUrl: string; path: string; contentType: string }> {
  // STEP 1 — Resolve canonical path
  const pathStr = getForumPath(docId);

  try {
    // STEP 2 — Generate v4 signed WRITE URL (O(1) + network)
    const [uploadUrl] = await bucket.file(pathStr).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 5 * 60 * 1000, // 5 minutes
      contentType: 'application/octet-stream',
    });

    console.log('ForumFB.ts [2004] › signForumUploadUrl.ok', { docId, path: pathStr });
    return { uploadUrl, path: pathStr, contentType: 'application/octet-stream' };
  } catch (err) {
    console.error('ForumFB.ts [2100] › signForumUploadUrl.error', { docId, path: pathStr, err });
    throw err;
  }
}

/**
 * @function mintForumJwt
 * @description
 *   Issue a short-lived RS256 JWT that authorizes the caller to join the Yjs room
 *   "forum:<docId>" as an "editor". The token includes { sub, doc, roles:["editor"] } and
 *   a conservative TTL (e.g., 10–15 minutes). The private key location is provided via
 *   process.env.JWT_PRIVATE_PATH. This function does not evaluate access itself—it assumes
 *   the caller was authorized by the API route. Time complexity: O(1).
 */
export async function mintForumJwt(
  docId: string,
  email: string,
  expiresSeconds = 15 * 60
): Promise<{ token: string; role: 'editor'; expiresIn: number; room: string }> {
  // STEP 1 — Validate inputs
  if (!email || typeof email !== 'string') {
    throw new Error('ForumFB.mintForumJwt: invalid email');
  }
  if (!docId || typeof docId !== 'string') {
    throw new Error('ForumFB.mintForumJwt: invalid docId');
  }

  // STEP 2 — Load private key based on env path (O(1) local I/O)
  const rawPath = process.env.JWT_PRIVATE_PATH;
  if (!rawPath) {
    console.error('ForumFB.ts [2005] › mintForumJwt.missingKeyPath');
    throw new Error('Server misconfiguration: JWT_PRIVATE_PATH not set');
  }
  const keyPath = path.isAbsolute(rawPath) ? rawPath : path.join(process.cwd(), rawPath);
  if (!fs.existsSync(keyPath)) {
    console.error('ForumFB.ts [2006] › mintForumJwt.keyMissing', { keyPath });
    throw new Error('Server misconfiguration: JWT private key file not found');
  }
  const privateKey = fs.readFileSync(keyPath, 'utf8');

  // STEP 3 — Mint token for room "forum:<docId>"
  const room = `forum:${docId}`;
  const payload = { sub: email.toLowerCase(), doc: room, roles: ['editor'] as const };
  const token = jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: expiresSeconds });

  console.log('ForumFB.ts [2007] › mintForumJwt.ok', { docId, sub: payload.sub, room, ttl: expiresSeconds });
  return { token, role: 'editor', expiresIn: expiresSeconds, room };
}
