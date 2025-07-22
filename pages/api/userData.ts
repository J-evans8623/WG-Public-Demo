// File: pages/api/userData.ts
/***************************************************************************************
 * @file pages/api/userData.ts
 * @description
 *   API endpoint for per-document user revision data, scoped by document ID.
 *   This handler now accepts an optional `docId` query parameter and directs all
 *   Firestore operations to `userData/{userId}/docs/{docId}`. If `docId` is absent,
 *   it defaults to `"root"` to preserve backward compatibility.  
 *   - GET: fetches the scoped document; returns 404 if not found.
 *   - PUT/POST: upserts the entire payload under the scoped path, stamping it
 *     with a server timestamp field `updatedAt`.  
 *   All methods authenticate via NextAuth and emit concise console logs
 *   (identified by unique 4‑digit codes) at entry, exit, and on errors.
 *
 * Responsibilities:
 *   • Authenticate incoming requests.
 *   • Parse and default the `docId` query parameter.
 *   • Route Firestore reads and writes to the correct sub-collection.
 *   • Handle GET, PUT, and POST methods with proper status codes.
 *   • Provide meaningful logs at key checkpoints for observability.
 ***************************************************************************************/

import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import { firestore } from '@/app/src/services/firebase';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ─── ① Authenticate ───────────────────────────────────────────────────────────────
  const session = await authenticateRequest(req, res);
  if (!session) return;
  const userId = session.user.email!;
  console.log('[userData.ts][2001] Authenticated user:', userId);

  // ─── ② Determine scoped document ID ────────────────────────────────────────────────
  const rawDocId = Array.isArray(req.query.docId)
    ? req.query.docId[0]
    : req.query.docId;
  const docId = rawDocId && rawDocId.trim() ? rawDocId.trim() : 'root';
  console.log('[userData.ts][2002] Using docId:', docId);

  // Build Firestore reference to `userData/{userId}/docs/{docId}`
  const docRef = firestore
    .collection('userData')
    .doc(userId)
    .collection('docs')
    .doc(docId);

  try {
    // ─── GET Handler ────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      console.log('[userData.ts][2003] GET userData for', { userId, docId });
      const snap = await docRef.get();
      if (!snap.exists) {
        console.log('[userData.ts][2004] Scoped userData not found');
        return res.status(404).json({ error: 'UserData not found' });
      }
      console.log('[userData.ts][2005] Scoped userData fetched');
      return res.status(200).json(snap.data());
    }

    // ─── PUT/POST Handler ────────────────────────────────────────────────────────────
    if (req.method === 'PUT' || req.method === 'POST') {
      console.log('[userData.ts][2006] Upserting userData for', { userId, docId });
      const payload = req.body;
      // Stamp with server timestamp for ordering
      payload.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      await docRef.set(payload, { merge: true });
      console.log('[userData.ts][2007] Scoped userData saved');
      return res.status(200).json({ message: 'UserData saved' });
    }

    // ─── Method Not Allowed ──────────────────────────────────────────────────────────
    console.log('[userData.ts][2008] Method not allowed:', req.method);
    res.setHeader('Allow', ['GET', 'PUT', 'POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('[userData.ts][2009] Error handling userData:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
