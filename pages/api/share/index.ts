/**
 * @file pages/api/share/index.ts
 * @responsibility
 *   • Create new share tokens for copy, collab, or flyer delivery.
 *   • Persist Invite in Firestore with all required fields explicitly defined.
 *   • Return { tokenId, url, flyerUrl? }.
 *
 * Important:
 *   - `permission` is always set to 'edit' for collab or 'view' for copy.
 *   - `emailList` is always an array (empty if no emails provided).
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { generateToken } from '@/app/src/utils/share/shareToken';
import { Invite } from '@/app/src/schemas/invites';
import { generateQrDataUri } from '@/app/src/share/generateQr';

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
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // Authenticate the user
  const session = await authenticateRequest(req, res);
  if (!session) return;

  try {
    const {
      resourceId,
      mode,
      delivery,
      emails = [],      // default to empty array
      expiryDays,
      singleUse = false // default to false
    } = req.body as ShareRequest;

    // Validate required fields
    if (!resourceId || !mode || !delivery) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // For collab invites, enforce an expiry window between 7 and 90 days
    if (
      mode === 'collab' &&
      (expiryDays == null || expiryDays < 7 || expiryDays > 90)
    ) {
      res.status(400).json({
        error: 'expiryDays must be between 7 and 90 for collab invites',
      });
      return;
    }

    // 1) Generate a secure token and compute expiry
    const tokenId = generateToken();
    const now = admin.firestore.Timestamp.now();
    const expiresAt =
      mode === 'collab'
        ? admin.firestore.Timestamp.fromMillis(
            now.toMillis() + (expiryDays || 30) * 24 * 60 * 60 * 1000
          )
        : now;

    // 2) Build the Invite object, supplying explicit defaults
    const invite: Invite = {
      id: tokenId,
      resourceId,
      ownerId: session.user.email,
      originalMode: mode,
      mode,
      delivery,
      permission: mode === 'collab' ? 'edit' : 'view', // always defined
      singleUse,
      uses: 0,
      issuedAt: now,
      expiresAt,
      joinWindowClosed: false,
      status: 'active',
      emailList: Array.isArray(emails) ? emails : []     // always an array
    };

    // 3) Persist to Firestore
    await firestore
      .collection(INVITES_COLLECTION)
      .doc(tokenId)
      .set(invite);

    // 4) Construct response URLs
    const url = `${FRONTEND_BASE_URL}/s/${tokenId}`;
    const flyerUrl =
      delivery === 'flyer'
        ? `${FRONTEND_BASE_URL}/api/flyer/${tokenId}.pdf`
        : undefined;


    let qrDataUri: string;
    try {
      qrDataUri = await generateQrDataUri(url);
      console.log('index.ts 1111 ○ QR Data-URI generated, length:', qrDataUri.length);
    } catch (err) {
      console.error('index.ts 1112 ✖ QR generation failed', err);
      res.status(500).json({ error: 'Failed to generate QR code' });
      return;
    }

    // 5) Return success
    res.status(201).json({ tokenId, url, flyerUrl, qrDataUri });
  } catch (err: any) {
    console.error('Share creation error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
