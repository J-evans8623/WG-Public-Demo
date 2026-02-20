/**
 * @file delete.ts
 * @description
 *   API Endpoint to delete a document:
 *     • If caller is owner:
 *         – Deletes the binary from Firebase Storage.
 *         – In a Firestore transaction:
 *             • Removes the file‐metadata doc under `userFiles/{docId}`.
 *             • Deletes the entire `documents/{docId}` tree (and its subcollections).
 *         – Recursively deletes all subcollections under `documents/{docId}`.
 *     • If caller is not owner:
 *         – Deletes their ACL entry under `documents/{docId}/editors/{userEmail}`.
 *         – Removes their email from `userFiles/{docId}.sharedWith`.
 *
 * Responsibilities:
 *   - Authenticate and enforce DELETE.
 *   - Enforce “owner-only” vs. “self-remove” logic.
 *   - Log critical checkpoints for observability.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import { deleteDocumentFile, removeEditor } from '@/app/src/services/firebase';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { performOwnerCascades } from '@/app/src/services/cascadeOps/DocumentDeleteCascade'; // update - 3
import { DocumentCascadeSummary } from '@/app/src/services/cascadeOps/cascadeTypes'; // update - 4

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  console.log('delete.ts 1001 › handler start, method=', req.method);

  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    console.log('delete.ts 1002 › method not allowed');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Authenticate user
  const session = await authenticateRequest(req, res);
  if (!session) {
    console.log('delete.ts 1003 › authentication failed');
    return;
  }
  const userEmail = session.user.email!;
  console.log('delete.ts 1004 › authenticated user=', userEmail);

  try {
    // Parse & validate query
    const fileStorageId = req.query.fileStorageId;
    if (!fileStorageId || typeof fileStorageId !== 'string') {
      console.log('delete.ts 1005 › missing or invalid fileStorageId');
      return res.status(400).json({ error: 'Missing fileStorageId parameter' });
    }

    // Derive docId from storage path "documents/{docId}.bloomdocx"
    const match = fileStorageId.match(/^documents\/(.+)\.bloomdocx$/);
    const docId = match ? match[1] : fileStorageId;
    console.log('delete.ts 1006 › derived docId=', docId);

    const firestore = admin.firestore();
    const metaRef = firestore.collection('userFiles').doc(docId);
    const metaSnap = await metaRef.get();

    if (!metaSnap.exists) {
      console.log('delete.ts 1007 › metadata not found for docId=', docId);
      return res.status(404).json({ error: 'File not found' });
    }

    const { ownerId } = metaSnap.data() as { ownerId: string };
    console.log('delete.ts 1008 › ownerId=', ownerId);

    // Non-owner: remove own access
    if (userEmail !== ownerId) {
      console.log('delete.ts 1009 › non-owner removal requested by=', userEmail);
      await removeEditor(docId, userEmail, { revoke: true });
      console.log('delete.ts 1010 › access removed for=', userEmail);
      return res
        .status(200)
        .json({ message: 'Your access to this document has been removed.' });
    }

    // Owner: proceed with full deletion
    console.log('delete.ts 1011 › owner deletion starting for docId=', docId);

    // 1) Delete binary from Storage
    await deleteDocumentFile(fileStorageId);
    console.log('delete.ts 1012 › deleteDocumentFile succeeded for=', fileStorageId);

    // 2) Firestore transaction to delete metadata and root document
    const userFilesRef = metaRef;
    const documentsRootRef = firestore.collection('documents').doc(docId);
    console.log('delete.ts 1013 › running transaction to delete metadata & root');
    await firestore.runTransaction(async (tx) => {
      tx.delete(userFilesRef);
      tx.delete(documentsRootRef);
    });
    console.log('delete.ts 1014 › transaction committed');

    // 3) Recursively delete all subcollections under documents/{docId}
    console.log('delete.ts 1015 › starting recursiveDelete');
    await firestore.recursiveDelete(documentsRootRef);
    console.log('delete.ts 1016 › recursiveDelete complete');

    // 4) update - 5: Perform forward-only cascades (non-critical best-effort)
    let cascades: DocumentCascadeSummary | null = null;
    try {
      cascades = await performOwnerCascades(docId, {
        email: ownerId,
        accountType: 'educator', // not used for cascade auth; email is used defensively
        subscriptionTier: 'premium',
        features: {
          canCreatePublicFiles: true,
          canInviteEditors: true,
          hasAdvancedFeatures: true,
        },
        limits: {
          maxCollaborators: 100,
          maxDocuments: 10000,
          maxStorageGB: 1000,
        },
      } as any);
      console.log('delete.ts 1017 › cascades complete', {
        gridfsDeleted: cascades.gridfs.deletedCount,
        embedDeleted: cascades.embeddings.deletedCount,
        warnings: cascades.warnings.length,
      });
    } catch (cascadeErr) {
      console.warn('delete.ts 1018 › cascade orchestration failed (non-fatal):', cascadeErr);
    }

    return res
      .status(200)
      .json({
      message: 'Document, metadata, and chat history deleted.',
      docId,
      cascades, // update - 6: surfaced result (can be null if orchestration failed early)
      warnings: cascades?.warnings ?? [],
    });
  } catch (error) {
    console.error('delete.ts 1999 › Delete endpoint error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
