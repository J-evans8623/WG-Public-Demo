/**
 * @file load.ts
 * @description
 * API Endpoint to load a document file from Firebase Storage.
 *
 * Responsibilities:
 * - Accept a GET request with a query parameter "fileStorageId" that specifies the file's storage path.
 * - Authenticate the incoming request using the session cookie.
 * - Retrieve the file from Firebase Storage and return its contents as a base64 encoded string.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { loadDocumentFile } from '@/app/src/services/firebase';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  // Allow only GET requests.
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Authenticate the incoming request.
  const sessionData = await authenticateRequest(req, res);
  if (!sessionData) {
    // The helper function already sends a 401 response if authentication fails.
    return;
  }

  try {
    // Step 1: Extract the fileStorageId from query parameters.
    const { fileStorageId } = req.query;
    if (!fileStorageId || typeof fileStorageId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid fileStorageId parameter' });
    }

    // Step 2: Retrieve the document file as a Buffer.
    const fileBuffer = await loadDocumentFile(fileStorageId);

    // Step 3: Encode the Buffer as a base64 string to return in JSON.
    const fileData = fileBuffer.toString('base64');

    // Step 4: Respond with the encoded file data.
    res.status(200).json({ fileData });
  } catch (error) {
    console.error('Error in load document endpoint:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
