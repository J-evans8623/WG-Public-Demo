// /pages/api/document/save.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import {
  storeDocumentFile,
  storeFileMetadata,
  setUserChat,
  ChatMessage,
} from '@/app/src/services/firebase';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';

interface SaveDocumentRequest {
  fileName: string;
  docFileID: string;
  fileData: string;
  chatData?: ChatMessage[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1) Auth
  const session = await authenticateRequest(req, res);
  if (!session) return;

  try {
    // 2) Parse & validate
    const { fileName, docFileID, fileData, chatData } =
      req.body as SaveDocumentRequest;
    if (!fileName || !docFileID || !fileData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 3) Upload binary
    const buffer = Buffer.from(fileData, 'base64');
    const storedPath = await storeDocumentFile(
      docFileID,
      buffer,
      { fileName, docFileID }
    );

    // 4) File metadata
    const ownerEmail = session.user.email;
    await storeFileMetadata({
      fileId: docFileID,
      ownerId: ownerEmail,
      fileName,
      fileStoragePath: storedPath,
      timestamp: admin.firestore.Timestamp.now(),
      fileSize: buffer.length,
      contentType: 'application/octet-stream',
      sharedWith: [],
    });

    // 5) Persist chat if provided
    if (Array.isArray(chatData)) {
      console.log('[105] chatData length:', chatData.length);
      await setUserChat(docFileID, ownerEmail, chatData);
    }

    // 6) Success
    res.status(200).json({ fileStorageId: storedPath });
  } catch (error) {
    console.error('Save endpoint error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
