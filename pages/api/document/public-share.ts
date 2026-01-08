/**
 * @file pages/api/document/public-share.ts
 * @description
 *   New public sharing API that replaces the deprecated token-based sharing system. This endpoint
 *   manages document sharing through public access flags (publicView and publicEdit) rather than
 *   individual share tokens. It integrates with the existing access control layer by setting
 *   document-level visibility flags that are enforced by resolveRole() and other ACL components.
 *   The API supports three sharing modes: private (no public access), public-view (read-only access
 *   for anyone with the link), and public-edit (edit access for anyone with the link). It also
 *   generates QR codes and supports flyer generation for marketing purposes. The response includes
 *   direct document URLs that work seamlessly with the existing Yjs collaboration system and
 *   access control infrastructure, eliminating the need for token redemption workflows.
 * 
 * Added 'fetchOnly' support to allow read-only retrieval of sharing artifacts
 * without mutating access control settings.
 * 
 * Responsibilities:
 *   - Authenticate requests and verify document ownership/editor permissions
 *   - Toggle publicView and publicEdit flags based on sharing mode
 *   - Generate QR codes for document URLs to support marketing use cases
 *   - Create flyer PDFs with embedded QR codes for print distribution
 *   - Return direct document URLs that integrate with existing access control
 *   - Log sharing activities for debugging and observability
 *   - Handle editor list management for restricted sharing modes
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { 
  setPublicEdit, 
  setPublicView, 
  addEditor,  
  resolveRole 
} from '@/app/src/services/firebase';
import { generateQrDataUri } from '@/app/src/share/generateQr';

interface PublicShareRequest {
  docId: string;
  mode?: 'private' | 'public-view' | 'public-edit';
  delivery?: 'link' | 'flyer';
  editors?: string[];
  fetchOnly?: boolean;
}

interface PublicShareResponse {
  success: boolean;
  url: string;
  qrDataUri?: string;
  flyerUrl?: string;
  mode: string;
  editorsCount?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PublicShareResponse | { error: string }>
): Promise<void> {
  console.log('public-share.ts 3001 › Request received', { method: req.method, body: req.body });

  // Step 1: Method validation
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // Step 2: Authentication
  const session = await authenticateRequest(req, res);
  if (!session) {
    console.log('public-share.ts 3002 › Authentication failed');
    return;
  }

  const userEmail = session.user?.email;
  if (!userEmail) {
    console.log('public-share.ts 3003 › No email in session');
    res.status(401).json({ error: 'No email in session' });
    return;
  }

  try {
    // Step 3: Parse and validate request body
    const { docId, mode, delivery = 'link', editors = [], fetchOnly } = req.body as PublicShareRequest;


    
    if (!docId) {
      console.log('public-share.ts 3004 › Missing required fields', { docId, mode });
      res.status(400).json({ error: 'Missing docId' });
      return;
    }

    if (!fetchOnly && !mode) {
       // console.log('public-share.ts 3004b › Missing mode for write operation');
       res.status(400).json({ error: 'Missing mode' });
       return;
    }

    if (!fetchOnly && mode && !['private', 'public-view', 'public-edit'].includes(mode)) {
      // console.log('public-share.ts 3005 › Invalid mode', { mode });
      res.status(400).json({ error: 'Invalid mode' });
      return;
    }

    // Step 4: Check user permissions
    const userRole = await resolveRole(docId, userEmail);
      

    // update - 6: Bifurcated permission check
    if (fetchOnly) {
        // For fetchOnly, any resolved role (Owner, Editor, Viewer) is sufficient.
        // resolveRole returns null/undefined if no access.
        if (!userRole) {
            // console.log('public-share.ts 3006a › Insufficient permissions for fetch', { userEmail, docId });
            res.status(403).json({ error: 'Insufficient permissions to view sharing settings' });
            return;
        }
    } else {
        // For write operations, enforce strict Owner/Editor check
        if (userRole !== 'Owner' && userRole !== 'Editor') {
            // console.log('public-share.ts 3006b › Insufficient permissions for write', { userEmail, userRole, docId });
            res.status(403).json({ error: 'Insufficient permissions to modify sharing settings' });
            return;
        }
    }


    console.log('public-share.ts 3007 › User authorized', { userEmail, userRole, docId, mode });
    if (!fetchOnly && mode) {
    // Step 5: Apply sharing mode
    switch (mode) {
      case 'private':
        // Disable both public flags
        await setPublicView(docId, false);
        await setPublicEdit(docId, false);
        console.log('public-share.ts 3008 › Set document to private', { docId });
        break;

      case 'public-view':
        // Enable public view, disable public edit
        await setPublicView(docId, true);
        await setPublicEdit(docId, false);
        console.log('public-share.ts 3009 › Set document to public-view', { docId });
        break;

      case 'public-edit':
        // Enable both public flags
        await setPublicView(docId, true);
        await setPublicEdit(docId, true);
        console.log('public-share.ts 3010 › Set document to public-edit', { docId });
        break;
    }

    // Step 6: Handle editor list for private/restricted sharing
    if (mode === 'private' && editors.length > 0) {
      console.log('public-share.ts 3011 › Processing editor list', { editorsCount: editors.length });
      
      // Add editors to the document
      for (const editorEmail of editors) {
        if (editorEmail.trim() && editorEmail !== userEmail) {
          await addEditor(docId, editorEmail.trim());
          console.log('public-share.ts 3012 › Added editor', { docId, editor: editorEmail });
        }
      }
    }
  }

    // Step 7: Generate document URL
    const baseUrl = process.env.FRONTEND_BASE_URL || 
                   `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
    const documentUrl = `${baseUrl}/workspace?doc=${encodeURIComponent(docId)}`;
    
    console.log('public-share.ts 3013 › Generated document URL', { documentUrl });

    // Step 8: Generate QR code if needed
    let qrDataUri: string | undefined;
    if (delivery === 'link' || delivery === 'flyer') {
      try {
        qrDataUri = await generateQrDataUri(documentUrl);
        console.log('public-share.ts 3014 › QR code generated', { qrLength: qrDataUri.length });
      } catch (qrError) {
        console.error('public-share.ts 3015 › QR generation failed', qrError);
        // Continue without QR code rather than failing the entire request
      }
    }

    // Step 9: Generate flyer URL if requested
    let flyerUrl: string | undefined;
    if (delivery === 'flyer') {
      flyerUrl = `${baseUrl}/api/flyer/${docId}.pdf`;
      console.log('public-share.ts 3016 › Flyer URL generated', { flyerUrl });
    }

    // Step 10: Prepare response
    const response: PublicShareResponse = {
      success: true,
      url: documentUrl,
      mode: mode || 'current',
      qrDataUri,
      flyerUrl,
      editorsCount: editors.length
    };

    console.log('public-share.ts 3017 › Sharing configured successfully', {
      docId,
      mode,
      hasQr: !!qrDataUri,
      hasFlyer: !!flyerUrl,
      editorsCount: editors.length
    });

    res.status(200).json(response);

  } catch (error: any) {
    console.error('public-share.ts 3018 › Error configuring share settings', {
      error: error.message,
      docId: req.body?.docId,
      mode: req.body?.mode
    });
    
    res.status(500).json({ 
      error: 'Failed to configure sharing settings' 
    });
  }
}