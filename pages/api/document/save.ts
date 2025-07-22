/**
 * @file save.ts
 * @description
 *   API endpoint to save a document plus optional chat.
 *   **Updates in this version:**
 *     - On first save: full metadata create + addEditor
 *     - On subsequent saves: partial metadata patch via updateFileMetadata()
 *
 * Responsibilities:
 *   - Authenticate request.
 *   - Branch on first vs. subsequent save.
 *   - Persist binary to stable path.
 *   - Persist metadata changes without overwriting owner or ACL.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import {
  storeDocumentFile,
  storeFileMetadata,
  updateFileMetadata,
  setUserChat,
  addEditor,
  ChatMessage
} from '@/app/src/services/firebase';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';

interface SaveDocumentRequest {
  fileName: string;
  docFileID: string;
  fileStoragePath: string;
  fileSize: number;
  chatData?: ChatMessage[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = await authenticateRequest(req, res);
  if (!session) return;

  try {
    const { fileName, docFileID, fileStoragePath, chatData, fileSize } =
      req.body as SaveDocumentRequest;
    if (!fileName || !docFileID || !fileStoragePath) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log('save.ts 1001 › Incoming save for', docFileID);


    // 2) Branch on first vs. subsequent save
    const metaRef  = admin.firestore().collection('userFiles').doc(docFileID);
    const metaSnap = await metaRef.get();
    if (!metaSnap.exists) {
      console.log('save.ts 1003 › First save detected');
      await storeFileMetadata({
        fileId: docFileID,
        ownerId: session.user.email,
        fileName,
        fileStoragePath,
        timestamp: admin.firestore.Timestamp.now(),
        fileSize,
        contentType: 'application/octet-stream',
        sharedWith: [],
      });
      console.log('save.ts 1004 › Metadata created');
      await addEditor(docFileID, session.user.email);
      console.log('save.ts 1005 › Owner added to editors');
    } else {
      console.log('save.ts 1006 › Subsequent save detected');
      await updateFileMetadata({
        fileId:          docFileID,
        fileName,
        fileStoragePath,
        timestamp:       admin.firestore.FieldValue.serverTimestamp(),
        fileSize,
        contentType:     'application/octet-stream'
      });
      console.log('save.ts 1007 › Metadata updated');
    }

    // 3) Persist chat if provided
    if (Array.isArray(chatData)) {
      console.log('save.ts 1008 › Saving chat, length=', chatData.length);
      await setUserChat(docFileID, session.user.email, chatData);
    }

    res.status(200).json({ fileStorageId: fileStoragePath });
  } catch (err) {
    console.error('save.ts 1009 › Save error', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
