/**
 * @file pages/api/document/download-urlv1.ts
 * @description
 *   Signed-URL generator for client downloads with integrated "files shared with me" tracking.
 *   This endpoint provides secure, time-limited download URLs for document and chat files while
 *   automatically maintaining user access tracking for shared documents. The system handles both
 *   explicit editor access (users directly added to editors array) and public access scenarios
 *   (users accessing via publicView/publicEdit flags). For users accessing documents through
 *   public sharing links who are not the owner or explicit editors, the system automatically
 *   adds them to the sharedWith array to enable "files shared with me" functionality in the
 *   home screen. This ensures seamless integration between the new access control system and
 *   user file management features, providing a unified experience where shared documents
 *   appear in users' file lists regardless of how access was granted. The endpoint enforces
 *   proper access control through role resolution while maintaining backward compatibility
 *   with existing authentication and authorization patterns. All responses include normalized
 *   access envelopes for client-side access layer synchronization.
 *
 * Responsibilities:
 *   - Authenticate requests via NextAuth session validation
 *   - Resolve user roles through the unified access control system
 *   - Generate time-limited signed URLs for Firebase Storage access
 *   - Track public access users in sharedWith arrays for file management
 *   - Return normalized access envelopes for client synchronization
 *   - Handle both document and chat file download requests
 *   - Enforce read access policies with appropriate error responses
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { generateDownloadUrl, getAclSnapshot, resolveRole, addToSharedWith } from '@/app/src/services/firebase';

/**
 * Normalizes email addresses to lowercase for consistent comparison across the system.
 * This function ensures that email-based access control comparisons are case-insensitive
 * and prevents access control bypasses due to case variations in email addresses.
 * 
 * @param email - The email address to normalize
 * @returns Normalized lowercase email address
 */
function normEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  // Step 1: Validate HTTP method
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Step 2: Authenticate the request
  const session = await authenticateRequest(req, res);
  if (!session) return;

  // Step 3: Extract and validate query parameters
  const docFileID = Array.isArray(req.query.docFileID)
    ? req.query.docFileID[0]
    : req.query.docFileID;
  const type = Array.isArray(req.query.type)
    ? (req.query.type[0] as 'doc' | 'chat')
    : (req.query.type as 'doc' | 'chat');

  console.log('[download-urlv1.ts][4901] › Request parameters validated', { docFileID, type, user: session.user.email });

  if (!docFileID || (type !== 'doc' && type !== 'chat')) {
    res.setHeader('Cache-Control', 'no-store');
    console.error('[download-urlv1.ts][4902] › Invalid request parameters', { docFileID, type });
    return res.status(400).json({ error: 'Invalid docFileID or type' });
  }

  try {
    // Step 4: Get document access control snapshot
    const acl = await getAclSnapshot(docFileID);
    if (!acl.docExists) {
      res.setHeader('Cache-Control', 'no-store');
      console.warn('[download-urlv1.ts][4903] › Document not found', { docId: docFileID });
      const access = {
        docId: docFileID,
        role: 'Viewer' as const,
        signal: 'EDIT_REVOKED' as const,
        source: 'download-urlv1' as const,
        at: new Date().toISOString(),
      };
      return res.status(404).json({ error: 'DOC_NOT_FOUND', access });
    }

    // Step 5: Resolve user role and check read access
    const role = await resolveRole(docFileID, session.user.email!);
    const canRead =
      role === 'Owner' || role === 'Editor' || role === 'Viewer' || acl.publicView;

    console.log('[download-urlv1.ts][4904] › Access control resolution completed', {
      docId: docFileID,
      user: session.user.email,
      role,
      canRead,
      publicView: acl.publicView,
      publicEdit: acl.publicEdit
    });

    if (!canRead) {
      res.setHeader('Cache-Control', 'no-store');
      const access = {
        docId: docFileID,
        role: 'Viewer' as const,
        signal: 'EDIT_REVOKED' as const,
        source: 'download-urlv1' as const,
        at: new Date().toISOString(),
      };
      console.warn('[download-urlv1.ts][4905] › Read access denied', { docId: docFileID, user: session.user.email, role });
      return res.status(403).json({ error: 'ACL_DENIED_READ', access });
    }

    // Step 6: Handle shared-with-me tracking for public access users
    if (canRead) {
      const userEmail = normEmail(session.user.email!);
      const ownerEmail = normEmail(acl.ownerId);
      const isExplicitEditor = acl.editors.includes(userEmail);
      const isOwner = userEmail === ownerEmail;
      
      // Step 7: Determine if user should be tracked in sharedWith array
      const shouldTrack = !isOwner && !isExplicitEditor && (acl.publicView || acl.publicEdit);
      
      if (shouldTrack) {
        try {
          await addToSharedWith(docFileID, session.user.email!);
          console.log('[download-urlv1.ts][4906] › User added to sharedWith for public access tracking', { 
            docId: docFileID, 
            user: session.user.email,
            role,
            publicView: acl.publicView,
            publicEdit: acl.publicEdit,
            accessType: 'public'
          });
        } catch (err) {
          console.warn('[download-urlv1.ts][4907] › Failed to add user to sharedWith array (non-fatal)', {
            docId: docFileID,
            user: session.user.email,
            error: err
          });
        }
      } else {
        console.log('[download-urlv1.ts][4908] › SharedWith tracking skipped', {
          docId: docFileID,
          user: session.user.email,
          role,
          isOwner,
          isExplicitEditor,
          publicView: acl.publicView,
          publicEdit: acl.publicEdit,
          reason: isOwner ? 'user-is-owner' : isExplicitEditor ? 'user-is-explicit-editor' : 'no-public-access'
        });
      }
    }

    // Step 8: Generate signed download URL
    const userId = session.user.email!;
    const { downloadUrl, path: fileStoragePath } = await generateDownloadUrl(docFileID, type, userId);

    // Step 9: Prepare successful response with access envelope
    res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    const access = {
      docId: docFileID,
      role: role === 'None' ? ('Viewer' as const) : role,
      signal: null as null,
      source: 'download-urlv1' as const,
      at: new Date().toISOString(),
      publicView: acl.publicView,
      publicEdit: acl.publicEdit,
    };
    
    console.log('[download-urlv1.ts][4909] › Signed download URL generated successfully', { 
      docId: docFileID, 
      type, 
      user: session.user.email,
      role 
    });
    
    return res.status(200).json({ downloadUrl, fileStoragePath, access });
  } catch (err) {
    console.error('[download-urlv1.ts][4999] › Error generating download URL', {
      docId: docFileID,
      type,
      user: session.user?.email,
      error: err
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: 'Failed to generate download URL' });
  }
}