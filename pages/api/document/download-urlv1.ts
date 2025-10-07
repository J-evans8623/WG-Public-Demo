/**
 * @file pages/api/document/download-urlv1.ts
 * @description
 *   Production-ready Next.js API endpoint that mints signed download URLs for document
 *   and chat artifacts stored in Firebase Storage while enforcing access control and
 *   updating “shared-with-me” tracking for public access flows. This file is part of
 *   Phase 3 of the front-end caching proposal and now **integrates with the updated
 *   firebase.ts helpers** to (1) resolve canonical paths consistently, (2) return
 *   authoritative persistence identifiers (GCS storage generation and Firestore
 *   logical version) for **documents** when requested, and (3) centralize all admin
 *   logic in the singleton service. The identifiers let the client seed `metadata.persist.*`
 *   inside the Y.Doc so collaborators share the latest precondition markers via Yjs,
 *   dramatically reducing 409 conflicts and removing redundant “download-before-save”
 *   behavior. The endpoint emits a normalized `{ access }` envelope for client-side
 *   synchronization and adds non-owners who visit via public links to the `sharedWith`
 *   set so the file appears in their library. All major steps include concise logs
 *   with unique numeric codes to aid debugging without noisy output.
 *
 * Responsibilities:
 *   1) Authenticate the caller and normalize inputs.
 *   2) Resolve role/ACL and enforce read access.
 *   3) Track public viewers/editors into `sharedWith` (shared-with-me).
 *   4) Mint time-limited signed READ URLs for the requested artifact.
 *   5) For documents, also return latest `{ storageGeneration, versionNumber }`
 *      so clients can seed Y.Doc persist markers on open.
 *   6) Return a normalized `{ access }` envelope for UI/state consistency.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import {
  generateDownloadUrl,        
  getAclSnapshot,
  resolveRole, 
  addToSharedWith
} from '@/app/src/services/firebase';

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

/**
 * @function handler
 * @description
 *   Main API handler that validates the request, enforces ACL, performs shared-with-me
 *   tracking for public viewers, and returns a signed URL for Firebase Storage reads.
 *   For `type='doc'`, the function also returns the latest persistence identifiers
 *   obtained through the unified `generateDownloadUrl(..., { includeIdentifiers: true })`
 *   flow implemented in firebase.ts. The client uses these identifiers to seed the
 *   Y.Doc’s `metadata.persist.*` values, aligning collaborators and dramatically
 *   reducing conflicts during conditional uploads after edits.
 *
 *   Steps (high level):
 *     1) Method + auth
 *     2) Parse/validate query
 *     3) ACL snapshot + role resolution
 *     4) Enforce read policy
 *     5) Shared-with-me tracking (public viewers)
 *     6) Signed URL minting (with identifiers for docs)
 *     7) Respond with URL, path, identifiers (doc), and `{access}`
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  // 1) Method guard
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2) Auth
  const session = await authenticateRequest(req, res);
  if (!session) return;

  // 3) Parse query
  const docFileID = Array.isArray(req.query.docFileID)
    ? req.query.docFileID[0]
    : req.query.docFileID;
  const type = Array.isArray(req.query.type)
    ? (req.query.type[0] as 'doc' | 'chat')
    : (req.query.type as 'doc' | 'chat');

  console.log('[download-urlv1.ts][4901] › parsed params', {
    docFileID,
    type,
    user: session.user.email
  });

  if (!docFileID || (type !== 'doc' && type !== 'chat')) {
    res.setHeader('Cache-Control', 'no-store');
    console.error('[download-urlv1.ts][4902] › invalid params', { docFileID, type });
    return res.status(400).json({ error: 'Invalid docFileID or type' });
  }

  try {
    // 4) ACL snapshot + existence
    const acl = await getAclSnapshot(docFileID);
    if (!acl.docExists) {
      res.setHeader('Cache-Control', 'no-store');
      console.warn('[download-urlv1.ts][4903] › doc not found', { docId: docFileID });
      const access = {
        docId: docFileID,
        role: 'Viewer' as const,
        signal: 'EDIT_REVOKED' as const,
        source: 'download-urlv1' as const,
        at: new Date().toISOString(),
      };
      return res.status(404).json({ error: 'DOC_NOT_FOUND', access });
    }

    // 5) Resolve role + canRead
    const role = await resolveRole(docFileID, session.user.email!, acl);
    const canRead =
      role === 'Owner' || role === 'Editor' || role === 'Viewer' || acl.publicView;

    console.log('[download-urlv1.ts][4904] › acl resolved', {
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
      console.warn('[download-urlv1.ts][4905] › read denied', {
        docId: docFileID,
        user: session.user.email,
        role
      });
      return res.status(403).json({ error: 'ACL_DENIED_READ', access });
    }

    // 6) Shared-with-me tracking for public flows
    const userEmail = normEmail(session.user.email!);
    const ownerEmail = normEmail(acl.ownerId);
    const isExplicitEditor = acl.editors.includes(userEmail);
    const isOwner = userEmail === ownerEmail;
    const shouldTrack = !isOwner && !isExplicitEditor && (acl.publicView || acl.publicEdit);

    if (shouldTrack) {
      try {
        await addToSharedWith(docFileID, session.user.email!);
        console.log('[download-urlv1.ts][4906] › sharedWith add (public viewer)', {
          docId: docFileID,
          user: session.user.email
        });
      } catch (err) {
        console.warn('[download-urlv1.ts][4907] › sharedWith add failed (non-fatal)', {
          docId: docFileID,
          user: session.user.email,
          error: err
        });
      }
    } else {
      console.log('[download-urlv1.ts][4908] › sharedWith skipped', {
        docId: docFileID,
        user: session.user.email,
        isOwner,
        isExplicitEditor,
        publicView: acl.publicView,
        publicEdit: acl.publicEdit
      });
    }

    // 7) Mint signed URL (and identifiers for documents)
    //    NOTE: firebase.ts now **requires** the `opts` parameter. We pass
    //    `{ includeIdentifiers: true }` for documents to seed Y.Doc persist markers.
    //    For chat, we pass `{ includeIdentifiers: false }`.
    const includeIdentifiers = type === 'doc'; // update - 2
    const userId = session.user.email!;
    const dl = await generateDownloadUrl(
      docFileID,
      type,
      { includeIdentifiers },     // update - 3 (mandatory opts)
      userId                      // update - 4 (kept for canonical path on chat)
    );

    // Discriminate return shape based on type
    const downloadUrl = (dl as any).downloadUrl as string;
    const fileStoragePath = (dl as any).path as string;
    const storageGeneration =
      includeIdentifiers ? ((dl as any).storageGeneration ?? null) : null; // update - 5
    const versionNumber =
      includeIdentifiers ? ((dl as any).versionNumber ?? null) : null;     // update - 6

    // 8) Access envelope
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

    console.log('[download-urlv1.ts][4909] › signed url ok', {
      docId: docFileID,
      type,
      user: session.user.email,
      role,
      withIds: includeIdentifiers,
      sg: storageGeneration,
      vn: versionNumber
    });

    // 9) Response
    return res.status(200).json({
      downloadUrl,
      fileStoragePath,
      access,
      // For documents we include identifiers so the client can seed Y.Doc:
      storageGeneration, // null for chats
      versionNumber      // null for chats
    });
  } catch (err) {
    console.error('[download-urlv1.ts][4999] › fatal', {
      docId: docFileID,
      type,
      user: session.user?.email,
      error: err
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: 'Failed to generate download URL' });
  }
}
