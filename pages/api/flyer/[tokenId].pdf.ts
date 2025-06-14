/**
 * @file pages/api/flyer/[tokenId].pdf.ts
 * @responsibility
 *   • HTTP GET /api/flyer/[tokenId].pdf
 *   • Lookup invite in Firestore; 410 if disabled or not active.
 *   • Call flyerRenderer to build the PDF.
 *   • Stream PDF back with caching headers.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import { renderFlyerPdf } from '@/app/src/share/flyerRenderer';

if (!admin.apps.length) admin.initializeApp();
const firestore = admin.firestore();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { tokenId } = req.query;
  if (typeof tokenId !== 'string') {
    return res.status(400).send('Invalid token');
  }

  try {
    const snap = await firestore
      .collection('invites')
      .doc(tokenId)
      .get();

    if (!snap.exists) {
      return res.status(404).send('Invite not found');
    }
    const invite = snap.data() as any;
    if (invite.status !== 'active') {
      return res.status(410).send('Invite no longer valid');
    }

    // Construct the URL that the QR code will point to
    const base = process.env.FRONTEND_BASE_URL!;
    const inviteUrl = `${base}/s/${tokenId}`;

    // Generate PDF
    const pdfBuffer = await renderFlyerPdf(invite, inviteUrl);

    // Cache for 1 hour
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Cache-Control',
      'public, max-age=3600, stale-while-revalidate=86400'
    );
    res.send(pdfBuffer);
  } catch (err: any) {
    console.error('Flyer generation error:', err);
    res.status(500).send('Internal Server Error');
  }
}
