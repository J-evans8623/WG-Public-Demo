/***************************************************************************************
 * @file delete.ts
 * @description
 *   API Endpoint to delete a document file from Firebase Storage and remove its metadata
 *   from Firestore. It:
 *     - Accepts a DELETE request with the query parameter "fileStorageId".
 *     - Authenticates the request using the session cookie.
 *     - Deletes the file from Firebase Storage.
 *     - Deletes the corresponding file metadata from Firestore.
 *
 * @author 
 * @date 
 ***************************************************************************************/
import type { NextApiRequest, NextApiResponse } from 'next';
import { deleteDocumentFile, deleteFileMetadata } from '@/app/src/services/firebase';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  // Allow only DELETE requests.
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Authenticate the incoming request.
  const sessionData = await authenticateRequest(req, res);
  if (!sessionData) {
    return;
  }

  try {
    // Step 1: Extract the fileStorageId from query parameters.
    const { fileStorageId } = req.query;
    if (!fileStorageId || typeof fileStorageId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid fileStorageId parameter' });
    }

    // Step 2: Derive the fileId from the fileStorageId.
    // Expected format: "documents/{fileId}.bloomdocx"
    let fileId = fileStorageId;
    if (fileStorageId.startsWith('documents/') && fileStorageId.endsWith('.bloomdocx')) {
      fileId = fileStorageId.substring(
        'documents/'.length,
        fileStorageId.length - '.bloomdocx'.length
      );
    }

    // Step 3: Delete the file from Firebase Storage.
    await deleteDocumentFile(fileStorageId);
    // Step 4: Delete the file metadata from Firestore.
    await deleteFileMetadata(fileId);

    // Step 5: Respond with a success message.
    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error in delete document endpoint:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
