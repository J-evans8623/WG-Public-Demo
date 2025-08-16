/**
 * @file pages/api/flyer/[docId].pdf.ts
 * @description
 *   Updated flyer generation API that integrates with the new access control-based sharing system.
 *   This endpoint replaces the deprecated token-based flyer generation by creating print-ready PDF
 *   promotional materials with embedded QR codes pointing to direct document URLs. The API leverages
 *   the existing flyerRenderer service while updating the URL generation to use direct document
 *   links instead of share token URLs. It maintains the marketing capabilities of the original
 *   system while simplifying the architecture by eliminating token redemption complexity. The
 *   generated flyers include document information, QR codes for easy mobile scanning, and
 *   professional formatting suitable for word-of-mouth marketing campaigns. Access control is
 *   enforced by verifying that the requesting user has appropriate permissions to generate
 *   promotional materials for the specified document.
 * 
 * Responsibilities:
 *   - Authenticate requests and verify document access permissions
 *   - Generate direct document URLs for QR code embedding
 *   - Create high-quality QR codes optimized for print media
 *   - Render professional PDF flyers with document branding
 *   - Stream PDF content with appropriate headers for download
 *   - Log flyer generation activities for analytics and debugging
 *   - Handle errors gracefully with meaningful error responses
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { resolveRole } from '@/app/src/services/firebase';
import { generateQrCodePng } from '@/app/src/share/qrService';
import {renderFlyerPdf, DocumentMeta} from '@/app/src/share/flyerRenderer';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  console.log('flyer-api.ts 6001 › Flyer generation request', { 
    method: req.method,
    docId: req.query.docId 
  });

  // Step 1: Method validation
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // Step 2: Extract document ID from route
  const docId = Array.isArray(req.query.docId) ? req.query.docId[0] : req.query.docId;
  
  if (!docId || typeof docId !== 'string') {
    console.log('flyer-api.ts 6002 › Invalid document ID', { docId });
    res.status(400).json({ error: 'Invalid document ID' });
    return;
  }

  // Step 3: Authentication
  const session = await authenticateRequest(req, res);
  if (!session) {
    console.log('flyer-api.ts 6003 › Authentication failed for flyer generation');
    return;
  }

  const userEmail = session.user?.email;
  if (!userEmail) {
    console.log('flyer-api.ts 6004 › No email in session');
    res.status(401).json({ error: 'No email in session' });
    return;
  }

  try {
    // Step 4: Check user permissions for document
    const userRole = await resolveRole(docId, userEmail);
    if (userRole === 'None') {
      console.log('flyer-api.ts 6005 › User lacks access to document', { 
        userEmail, 
        docId, 
        role: userRole 
      });
      res.status(403).json({ error: 'Insufficient permissions to generate flyer' });
      return;
    }

    console.log('flyer-api.ts 6006 › User authorized for flyer generation', {
      userEmail,
      docId,
      role: userRole
    });

    // Step 5: Generate direct document URL
    const baseUrl = process.env.FRONTEND_BASE_URL || 
                   `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    const documentUrl = `${baseUrl}/studygraph?doc=${encodeURIComponent(docId)}`;
    
    console.log('flyer-api.ts 6007 › Generated document URL for QR code', { documentUrl });

    // Step 6: Generate high-quality QR code for print
    const qrCodeBuffer = await generateQrCodePng(documentUrl, 300);

    console.log('flyer-api.ts 6008 › QR code generated', { 
      qrSizeBytes: qrCodeBuffer.length 
    });
// Step 7: Prepare simplified document metadata (no expiry needed)
const documentMeta = {
  id: docId,
  resourceId: docId,
  ownerId: userEmail,
  title: 'Shared Document' // Could be enhanced to fetch actual document title
};

// Step 8: Generate PDF flyer using the updated renderFlyerPdf function
const pdfBuffer = await renderFlyerPdf(documentMeta, documentUrl);
    
    console.log('flyer-api.ts 6009 › PDF flyer generated successfully', {
      docId,
      pdfSizeBytes: pdfBuffer.length,
      userEmail
    });

    // Step 9: Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="document-${docId}-flyer.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Step 10: Stream PDF to client
    res.status(200).send(pdfBuffer);

    console.log('flyer-api.ts 6010 › Flyer PDF streamed successfully', {
      docId,
      userEmail,
      fileSize: pdfBuffer.length
    });

  } catch (error: any) {
    console.error('flyer-api.ts 6011 › Flyer generation failed', {
      error: error.message,
      docId,
      userEmail,
      stack: error.stack
    });

    // Handle specific error types
    if (error.message.includes('Document not found')) {
      res.status(404).json({ error: 'Document not found' });
    } else if (error.message.includes('QR')) {
      res.status(500).json({ error: 'Failed to generate QR code' });
    } else if (error.message.includes('PDF')) {
      res.status(500).json({ error: 'Failed to generate PDF' });
    } else {
      res.status(500).json({ error: 'Failed to generate flyer' });
    }
  }
}