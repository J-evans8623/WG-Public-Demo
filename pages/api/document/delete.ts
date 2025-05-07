/**
 * @file delete.ts
 * @description
 *   API Endpoint to delete a document:
 *     • Deletes the binary from Firebase Storage.
 *     • In a Firestore transaction:
 *         – Removes the file‐metadata doc under `userFiles/{docId}`.
 *         – Deletes the entire `documents/{docId}` tree (and all its subcollections).
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import { deleteDocumentFile } from '@/app/src/services/firebase';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Authenticate user
  const session = await authenticateRequest(req, res);
  if (!session) return;

  try {
    // Parse & validate query
    const fileStorageId = req.query.fileStorageId;
    if (!fileStorageId || typeof fileStorageId !== 'string') {
      return res.status(400).json({ error: 'Missing fileStorageId parameter' });
    }

    // Derive docId from storage path "documents/{docId}.bloomdocx"
    const match = fileStorageId.match(/^documents\/(.+)\.bloomdocx$/);
    const docId = match ? match[1] : fileStorageId;

    // 1) Delete the binary from Storage
    await deleteDocumentFile(fileStorageId);

    // 2) Firestore transaction to delete both metadata and the entire documents/{docId} subtree
    const firestore = admin.firestore();
    const userFilesRef = firestore.collection('userFiles').doc(docId);
    const documentsRootRef = firestore.collection('documents').doc(docId);

    await firestore.runTransaction(async (tx) => {
      // Delete the userFiles/{docId} metadata
      tx.delete(userFilesRef);
      // Delete the root document, which will mark it removed—subcollections must be
      // removed with recursiveDelete (cannot be done in a transaction)
      tx.delete(documentsRootRef);
    });

    // 3) Recursively delete all subcollections under documents/{docId}
    await firestore.recursiveDelete(documentsRootRef);

    return res.status(200).json({ message: 'Document, metadata, and chat history deleted.' });
  } catch (error) {
    console.error('Delete endpoint error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
