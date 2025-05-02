/**
 * @file list.ts
 * @description
 * API Endpoint to list recent file metadata for the authenticated user.
 *
 * Responsibilities:
 * - Accept a GET request.
 * - Authenticate the user (via request headers or middleware).
 * - Query Firestore for file metadata where the ownerId matches the user or the user is in the sharedWith array.
 * - Return the metadata sorted by the Timestamp (last saved time) in descending order.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { listUserFiles } from '@/app/src/services/firebase';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  // Only allow GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Step 1: Check the session from the cookie
    const sessionData = await authenticateRequest(req, res);
    if (!sessionData) {
      // authenticateRequest already sent a 401 if invalid
      return;
    }

    // Step 2: We have a valid session; retrieve the userId
    const userId = sessionData.user.email;

    // Step 3: Query Firestore for file metadata
    const files = await listUserFiles(userId);

    // Step 4: Return the list of files
    res.status(200).json({ files });
  } catch (error) {
    console.error('Error in file listing endpoint:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
