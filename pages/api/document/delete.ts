/**
 * @file delete.ts
 * @description
 * API Endpoint updated to support the 30-day Soft-Delete policy. 
 * - Owners: Metadata is moved to a recovery bin; physical data is preserved.
 * - Collaborators: Existing logic to remove themselves from ACL is maintained.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import { removeEditor } from '@/app/src/services/firebase'; // update - 1.1: Removed hard-delete Storage import
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { softDeleteNotebook } from '@/app/src/services/FileRetentionService'; // update - 1.2: Import new service

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

  const session = await authenticateRequest(req, res);
  if (!session) {
    console.log('delete.ts 1003 › authentication failed');
    return;
  }
  const userEmail = session.user.email!;
  console.log('delete.ts 1004 › authenticated user=', userEmail);

  try {
    const fileStorageId = req.query.fileStorageId;
    if (!fileStorageId || typeof fileStorageId !== 'string') {
      console.log('delete.ts 1005 › missing or invalid fileStorageId');
      return res.status(400).json({ error: 'Missing fileStorageId parameter' });
    }

    const match = fileStorageId.match(/^documents\/(.+)\.bloomdocx$/);
    const docId = match ? match[1] : fileStorageId;
    
    const firestore = admin.firestore();
    const metaRef = firestore.collection('userFiles').doc(docId);
    const metaSnap = await metaRef.get();

    if (!metaSnap.exists) {
      console.log('delete.ts 1007 › metadata not found for docId=', docId);
      return res.status(404).json({ error: 'File not found' });
    }

    const { ownerId } = metaSnap.data() as { ownerId: string };

    if (userEmail !== ownerId) {
      console.log('delete.ts 1009 › non-owner removal requested by=', userEmail);
      await removeEditor(docId, userEmail, { revoke: true });
      return res.status(200).json({ message: 'Your access to this document has been removed.' });
    }

    // --- Soft Delete Logic for Owners ---
    // update - 1.3: Proceed with archival instead of destruction
    console.log('delete.ts 1011 › owner soft-deletion starting for docId=', docId);

    // 1. Call the new retention service to bin the metadata
    // This replaces deleteDocumentFile, recursiveDelete, and performOwnerCascades
    await softDeleteNotebook(docId, userEmail); 

    console.log('delete.ts 1014 › notebook binned successfully');

    return res
      .status(200)
      .json({
      message: 'Document has been moved to the recovery bin for 30 days.',
      docId,
      status: 'archived'
    });
    // --- End Soft Delete Logic ---

  } catch (error) {
    console.error('delete.ts 1999 › Delete endpoint error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}