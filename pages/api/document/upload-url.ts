/**
 * @file pages/api/document/upload-url.ts
 * @description
 *   Endpoint to generate V4 signed URLs for client uploads of doc or chat.
 *   - 'doc' → single shared file per document.
 *   - 'chat' → per-user JSON under privateChats/{userId}.
 *
 * Responsibilities:
 *   - Authenticate via NextAuth.
 *   - Validate query params.
 *   - Delegate to generateUploadUrl().
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { generateUploadUrl } from '@/app/src/services/firebase';

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

  console.log('upload-url.ts 3001 › params', { docFileID, type });
  if (!docFileID || (type !== 'doc' && type !== 'chat')) {
    console.error('upload-url.ts 3002 › invalid params');
    return res.status(400).json({ error: 'Invalid docFileID or type' });
  }

  try {
    const userId = session.user.email!;
    const { uploadUrl, path } = await generateUploadUrl(docFileID, type, userId);
    console.log('upload-url.ts 3003 › signed URL ready', { path });
    res.status(200).json({ uploadUrl, fileStoragePath: path });
  } catch (err) {
    console.error('upload-url.ts 3004 › error generating URL', err);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
}
