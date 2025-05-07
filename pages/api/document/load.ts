// /pages/api/document/load.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import {
  loadDocumentFile,
  getUserChat,
  ChatMessage,
} from '@/app/src/services/firebase';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1) Auth
  const session = await authenticateRequest(req, res);
  if (!session) return;

  try {
    // 2) fileStorageId param
    const fileStorageId = req.query.fileStorageId;
    if (!fileStorageId || typeof fileStorageId !== 'string') {
      return res.status(400).json({ error: 'Missing fileStorageId' });
    }

    // 3) Download binary
    const fileBuffer = await loadDocumentFile(fileStorageId);
    const fileData = fileBuffer.toString('base64');

    // 4) Derive docId + load chat
    const match = fileStorageId.match(/^documents\/(.+)\.bloomdocx$/);
    const docId = match ? match[1] : fileStorageId;
    const userEmail = session.user.email;
    const chatData: ChatMessage[] = await getUserChat(docId, userEmail);

    console.log('[106] returning chatData length:', chatData.length);

    // 5) Respond
    res.status(200).json({ fileData, chatData });
  } catch (error) {
    console.error('Load endpoint error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
