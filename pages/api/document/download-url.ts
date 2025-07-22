/**
 * @file pages/api/document/download-url.ts
 * @description
 *   Endpoint to generate V4 signed URLs for client downloads of doc or chat.
 *
 * Responsibilities:
 *   - Authenticate via NextAuth.
 *   - Validate query params.
 *   - Delegate to generateDownloadUrl().
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { generateDownloadUrl } from '@/app/src/services/firebase';

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

  const docFileID = Array.isArray(req.query.docFileID)
    ? req.query.docFileID[0]
    : req.query.docFileID;
  const type = Array.isArray(req.query.type)
    ? req.query.type[0]
    : req.query.type;

  console.log('download-url.ts 4001 › params', { docFileID, type });
  if (!docFileID || (type !== 'doc' && type !== 'chat')) {
    console.error('download-url.ts 4002 › invalid params');
    return res.status(400).json({ error: 'Invalid docFileID or type' });
  }

  try {
    const userId = session.user.email!;
    const { downloadUrl, path } = await generateDownloadUrl(docFileID, type, userId);
    console.log('download-url.ts 4003 › signed URL ready', { path });
    res.status(200).json({ downloadUrl, fileStoragePath: path });
  } catch (err) {
    console.error('download-url.ts 4004 › error generating URL', err);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
}
