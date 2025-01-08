/**
 * File: /pages/api/drive/[...drive].ts
 * Responsibility: Handle Google Drive operations via proxy endpoints.
 * Dependencies:
 *   - /server/services/google-drive.ts for GoogleDriveService
 *   - /server/auth/session.ts for SessionManager
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleDriveService } from '../../src/services/googleDrive';
import { RedisSessionManager } from '../../src/auth/session';

const sessionManager = new RedisSessionManager();
const driveService = new GoogleDriveService();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { drive } = req.query;
    const sessionId = req.cookies.sessionId;
  
    if (!sessionId) {
      return res.status(401).json({ error: 'Unauthorized: No session found' });
    }
  
    try {
      const sessionData = await sessionManager.ensureValidSession(sessionId);
  
      switch (drive) {
        case 'save':
          if (req.method === 'POST') {
            const { content } = req.body;
            if (!content) {
              return res.status(400).json({ error: 'Content is required for saving a document' });
            }
  
            const fileId = await driveService.saveDocument(sessionData.userId, content);
            return res.status(200).json({ fileId });
          }
          break;
  
        case 'load':
          if (req.method === 'GET') {
            const { fileId } = req.query;
            if (!fileId || typeof fileId !== 'string') {
              return res.status(400).json({ error: 'Invalid file ID' });
            }
  
            const fileData = await driveService.loadDocument(sessionData.userId, fileId);
            return res.status(200).json({ fileData });
          }
          break;
  
        default:
          return res.status(404).json({ error: 'Route not found' });
      }
    } catch (error) {
      return res.status(500).json({ error: error });
    }
  }
