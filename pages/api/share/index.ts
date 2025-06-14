/**
 * @file pages/api/share/index.ts
 * @responsibility
 *   • Create new share tokens for copy, collab, or flyer delivery.
 *   • Persist Invite in Firestore.
 *   • Return { tokenId, url, flyerUrl? }.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { generateToken } from '@/app/src/utils/share/shareToken';
import { Invite } from '@/app/src/schemas/invites';

if (!admin.apps.length) admin.initializeApp();
const firestore = admin.firestore();

const INVITES_COLLECTION = 'invites';
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL!;

interface ShareRequest {
  resourceId: string;
  mode: 'copy' | 'collab';
  delivery: 'link' | 'email' | 'flyer';
  emails?: string[];
  expiryDays?: number;
  singleUse?: boolean;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = await authenticateRequest(req, res);
  if (!session) return;

  try {
    const { resourceId, mode, delivery, emails, expiryDays, singleUse } =
      req.body as ShareRequest;

    if (!resourceId || !mode || !delivery) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (
      mode === 'collab' &&
      (expiryDays == null || expiryDays < 7 || expiryDays > 90)
    ) {
      return res
        .status(400)
        .json({ error: 'expiryDays must be between 7 and 90' });
    }

    // 1) Generate token and invite record
    const tokenId = generateToken();
    const now = admin.firestore.Timestamp.now();
    const expiresAt =
      mode === 'collab'
        ? admin.firestore.Timestamp.fromMillis(
            now.toMillis() + (expiryDays || 30) * 24 * 60 * 60 * 1000
          )
        : now;

    const invite: Invite = {
      id: tokenId,
      resourceId,
      ownerId: session.user.email,
      originalMode: mode,
      mode,
      delivery,
      permission: mode === 'collab' ? 'edit' : undefined,
      singleUse: !!singleUse,
      uses: 0,
      issuedAt: now,
      expiresAt,
      joinWindowClosed: false,
      status: 'active',
      emailList: delivery === 'email' ? emails || [] : undefined,
    };

    await firestore.collection(INVITES_COLLECTION).doc(tokenId).set(invite);

    // 2) Build response URLs
    const url = `${FRONTEND_BASE_URL}/s/${tokenId}`;
    const flyerUrl =
      delivery === 'flyer'
        ? `${FRONTEND_BASE_URL}/api/flyer/${tokenId}.pdf`
        : undefined;

    res.status(201).json({ tokenId, url, flyerUrl });
  } catch (err: any) {
    console.error('Share creation error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
