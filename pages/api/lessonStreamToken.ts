/**
 * pages/api/lessonStreamToken.ts
 *
 * Responsibilities:
 *   - Authenticate incoming GET requests via our BFF (NextAuth).
 *   - Validate the `fileId` query parameter.
 *   - Confirm ownership by looking up userFiles/{fileId}.ownerId in Firestore.
 *   - Mint a Firebase Custom Token (with a short‐lived fileId claim).
 *   - Return JSON `{ token }`.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { firestore, auth } from '@/app/src/services/firebase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // 1) Authenticate via BFF
  const session = await authenticateRequest(req, res);
  if (!session) return;

  // 2) Extract & validate fileId
  const raw = req.query.fileId;
  const fileId = Array.isArray(raw) ? raw[0] : raw;
  if (!fileId) {
    return res.status(400).json({ error: 'Missing fileId query parameter' });
  }

  try {
    // 3) Verify ownership in Firestore
    const doc = await firestore.collection('userFiles').doc(fileId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'File not found' });
    }
    const ownerId = doc.data()?.ownerId;
    const userEmail = session.user.email;
    if (ownerId !== userEmail) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // 4) Mint Custom Token with fileId claim
    //    (using user's email as Firebase UID)
    const firebaseUid = userEmail!;
    const token = await auth.createCustomToken(firebaseUid, { fileId });

    // 5) Return token
    return res.status(200).json({ token });
  } catch (err) {
    console.error('[lessonStreamToken] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
