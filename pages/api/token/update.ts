/**
 * @file pages/api/token/update.ts
 * @description Owner-only endpoint to revoke or convert an active invite to copy-only.
 * @responsibility
 *   • Authenticate owner.
 *   • Support two actions in the PATCH body:
 *       – "revoke"           → status = 'disabled'
 *       – "convert-to-copy"  → mode = 'copy', joinWindowClosed = true
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';

const firestore = admin.firestore();
const INVITES_COLLECTION = 'invites';

interface UpdateRequest {
  action: 'revoke' | 'convert-to-copy';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const session = await authenticateRequest(req, res);
  if (!session) return;

  const tokenId = req.query.token;
  if (typeof tokenId !== 'string') {
    return res.status(400).json({ error: 'Invalid token parameter' });
  }

  const body = req.body as UpdateRequest;
  if (!body.action || !['revoke', 'convert-to-copy'].includes(body.action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  try {
    const ref = firestore.collection(INVITES_COLLECTION).doc(tokenId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Invite not found' });
    const data = snap.data();
    if (data!.ownerId !== session.user.email) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updates: any = {};
    if (body.action === 'revoke') {
      updates.status = 'disabled';
    } else if (body.action === 'convert-to-copy') {
      updates.mode = 'copy';
      updates.joinWindowClosed = true;
    }

    await ref.update(updates);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Invite update error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
