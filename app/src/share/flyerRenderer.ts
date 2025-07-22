/**
 * @file server/flyerRenderer.ts
 * @responsibility
 *   • Compose a print-ready PDF (A5 portrait) containing:
 *       – [optional] logo
 *       – resource title (“Study Group: …”)
 *       – owner handle (“Owner: @…”)
 *       – large QR code linking to the share URL
 *       – “Join before <date>” and post-expiry note
 *   • Return the PDF as a Buffer.
 */

import PDFDocument from 'pdfkit';
import { generateQrCodePng } from './qrService';

export interface InviteMeta {
  id: string;
  resourceId: string;
  ownerId: string;
  issuedAt: FirebaseFirestore.Timestamp;
  expiresAt: FirebaseFirestore.Timestamp;
  // other fields omitted
}

/**
 * Render a flyer PDF for the given invite.
 * @param invite Invite metadata from Firestore.
 * @param inviteUrl Full URL (e.g. https://app.example.com/s/<tokenId>).
 * @returns PDF data as a Buffer.
 */
export async function renderFlyerPdf(
  invite: InviteMeta,
  inviteUrl: string
): Promise<Buffer> {
  // Generate QR code PNG for embedding
  const qrBuffer = await generateQrCodePng(inviteUrl, 200);

  // PDF dimensions: A5 portrait (420×595 points)
  const doc = new PDFDocument({
    size: [420, 595],
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) =>
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  );

  // Header: optional logo (replace path as needed)
  // const logoPath = path.join(process.cwd(), 'public', 'logo.png');
  // doc.image(logoPath, 40, 40, { width: 100 });

  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .text(`Study Group: ${invite.resourceId}`, { align: 'left' })
    .moveDown(0.5);

  doc
    .font('Helvetica')
    .fontSize(14)
    .text(`Owner: @${invite.ownerId}`, { align: 'left' });

  // QR code, centered
  const qrX = (420 - 200) / 2;
  const qrY = 150;
  doc.image(qrBuffer, qrX, qrY, { width: 200, height: 200 });

  // Caption under QR
  doc
    .font('Helvetica')
    .fontSize(12)
    .text('Scan to join', qrX, qrY + 210, {
      width: 200,
      align: 'center',
    });

  // Expiry note
  const joinUntil = invite.expiresAt.toDate().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  doc
    .moveDown(2)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(`Join before: ${joinUntil}`, { align: 'center' })
    .moveDown(0.5);

  doc
    .font('Helvetica')
    .fontSize(10)
    .text(
      'After that date, scanning still gives you your own copy of the map.',
      { align: 'center' }
    );

  doc.end();
  return done;
}
