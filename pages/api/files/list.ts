// pages/api/files/list.ts

/**
 * @file pages/api/files/list.ts
 * @description
 *   API endpoint to list recent file metadata for the authenticated user.
 *   Now returns separate arrays: ownedFiles and sharedFiles.
 *
 * Responsibilities:
 *   - Accept a GET request.
 *   - Authenticate the user.
 *   - Query Firestore (via listUserFiles) for owned and shared files.
 *   - Return both arrays in JSON.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { listUserFiles } from '@/app/src/services/firebase';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = await authenticateRequest(req, res);
  if (!session) return;

  const userEmail = session.user.email;
  console.log('list.ts 8001 › listing files for', userEmail);

  try {
    const { ownedFiles, sharedFiles } = await listUserFiles(userEmail!);
    console.log('list.ts 8002 › owned count:', ownedFiles.length, 'shared count:', sharedFiles.length);
    res.status(200).json({ ownedFiles, sharedFiles });
  } catch (err) {
    console.error('list.ts 8003 › Error listing files', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
