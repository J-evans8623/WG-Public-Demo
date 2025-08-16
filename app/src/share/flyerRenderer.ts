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

export interface DocumentMeta {
  id: string;
  resourceId: string;
  ownerId: string;
  title?: string;
}

/**
 * Render a flyer PDF for the given document metadata.
 * @param documentMeta Document metadata for the flyer.
 * @param documentUrl Direct URL to the document.
 * @returns PDF data as a Buffer.
 */
export async function renderFlyerPdf(
  documentMeta: {
    id: string;
    resourceId: string;
    ownerId: string;
    title?: string;
  },
  documentUrl: string
): Promise<Buffer> {
  // Generate QR code PNG for embedding
  const qrBuffer = await generateQrCodePng(documentUrl, 200);

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
    .text(`Document: ${documentMeta.title || documentMeta.resourceId}`, { align: 'left' })
    .moveDown(0.5);

  doc
    .font('Helvetica')
    .fontSize(14)
    .text(`Shared by: ${documentMeta.ownerId}`, { align: 'left' });

  // QR code, centered
  const qrX = (420 - 200) / 2;
  const qrY = 150;
  doc.image(qrBuffer, qrX, qrY, { width: 200, height: 200 });

  // Caption under QR - simplified without expiry
  doc
    .font('Helvetica')
    .fontSize(12)
    .text('Scan to access document', qrX, qrY + 210, {
      width: 200,
      align: 'center',
    });

  // Remove expiry logic - add simple access note instead
  doc
    .moveDown(2)
    .font('Helvetica')
    .fontSize(10)
    .text(
      'Access permissions are controlled by the document owner.',
      { align: 'center' }
    );

  doc.end();
  return done;
}
