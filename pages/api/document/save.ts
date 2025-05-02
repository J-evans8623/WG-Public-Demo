/**
 * @file save.ts
 * @description
 * API Endpoint to save a document file into Firebase Storage.
 *
 * Responsibilities:
 * - Accept a POST request with a JSON payload containing:
 *    - fileName: string
 *    - docFileID: string
 *    - fileData: base64 encoded string representing the document binary data.
 * - Decode the fileData and store it in Firebase Storage.
 * - Store file metadata into Firestore so that the "recent files" feature can locate it.
 * - Return a JSON response with the file storage identifier.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { storeDocumentFile, storeFileMetadata } from '@/app/src/services/firebase';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import admin from 'firebase-admin';

interface SaveDocumentRequest {
  fileName: string;
  docFileID: string;
  fileData: string; // base64 encoded file data
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  // Allow only POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Authenticate the request using the session cookie.
  const sessionData = await authenticateRequest(req, res);
  if (!sessionData) {
    // authenticateRequest already responded with 401 if session is invalid.
    return;
  }

  try {
    // Step 1: Parse the request body as JSON.
    const { fileName, docFileID, fileData } = req.body as SaveDocumentRequest;
    if (!fileName || !docFileID || !fileData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Step 2: Decode the base64 file data into a Buffer.
    const buffer = Buffer.from(fileData, 'base64');

    // Step 3: Use docFileID as fileId (or generate one if needed).
    const fileId = docFileID;

    // Step 4: Store the document file into Firebase Storage.
    const storedFileId = await storeDocumentFile(fileId, buffer, { fileName, docFileID });

    // Step 5: Store the file metadata into Firestore.
    // Use the user's email if available; otherwise, use the derived userId.
    const ownerId = sessionData.user.email;
    await storeFileMetadata({
      fileId,
      ownerId,
      fileName,
      fileStoragePath: storedFileId,
      timestamp: admin.firestore.Timestamp.now(),
      fileSize: buffer.length,
      contentType: 'application/octet-stream',
      sharedWith: []
    });

    // Step 6: Respond with success and return the file storage identifier.
    res.status(200).json({ fileStorageId: storedFileId });
  } catch (error) {
    console.error('Error in save document endpoint:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
