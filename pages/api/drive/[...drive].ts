/**
 * File: /pages/api/drive/[...drive].ts
 * Responsibility: Handle Google Drive operations via proxy endpoints.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleDriveService } from '../../../app/src/services/googleDrive';
import { GoogleOAuthManager } from '../../../app/src/auth/oauth';
import { RedisSessionManager } from '../../../app/src/auth/session';
import { AuthConfig } from '../../../app/src/auth/types';
import dotenv from 'dotenv';
import { parse } from 'cookie';

dotenv.config();
// 1) Construct the AuthConfig
const authConfig: AuthConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: process.env.GOOGLE_REDIRECT_URI!,
  scopes: [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/drive.file',
  ],
};

// 2) Instantiate the OAuth Manager
const oauthManager = new GoogleOAuthManager(authConfig);

// 3) Instantiate Session Manager with the OAuth manager
const sessionManager = new RedisSessionManager(oauthManager);

// 4) Instantiate the Google Drive Service with the injected session manager
const driveService = new GoogleDriveService(sessionManager);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { drive } = req.query;

  // Ensure `drive` is always an array and get the first element
  const route = Array.isArray(drive) ? drive[0] : drive;

  console.log('Drive route accessed:', route); // Updated to log `route` instead of `drive`
  console.log('Request method:', req.method);

  // Parse cookies to extract sessionId
  const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
  const sessionId = cookies.sessionId;

  if (!sessionId) {
    console.warn('Unauthorized access: No session ID found');
    return res.status(401).json({ error: 'Unauthorized: No session found' });
  }

  try {
    // Validate or refresh the session to ensure the access token is valid
    console.log('Validating session for sessionId:', sessionId);
    const sessionData = await sessionManager.ensureValidSession(sessionId);
    console.log('Validated session data:', sessionData);

    switch (route) {
      case 'save':
        console.log('Handling "save" route');
        if (req.method === 'POST') {
          const { content, fileName } = req.body;
          console.log('Received save request with content:', content);
          if (!content) {
            console.warn('Save request missing content');
            return res.status(400).json({ error: 'Content is required for saving a document' });
          }
          // Pass the sessionId to driveService to retrieve session data
          const fileId = await driveService.saveDocument(sessionId, content, fileName);
          console.log('Document saved with fileId:', fileId);
          return res.status(200).json({ fileId, fileName });
        }
        console.warn('Invalid method for "save" route:', req.method);
        break;

        case 'load':
          console.log('Handling "load" route');
          if (req.method === 'GET') {
            const { fileId } = req.query;
            console.log('Loading file with fileId:', fileId);
            if (!fileId || typeof fileId !== 'string') {
              console.warn('Invalid file ID provided:', fileId);
              return res.status(400).json({ error: 'Invalid file ID' });
            }
            // Retrieve binary data
            const buffer = await driveService.loadDocument(sessionId, fileId);
            console.log('File loaded:', buffer);
            
            // Set appropriate headers for binary data
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename=${fileId}.bloomdocx`);
            
            return res.status(200).send(buffer);
          }
          console.warn('Invalid method for "load" route:', req.method);
          break;
        

        case 'list':
          console.log('Handling "list" route');
          if (req.method === 'GET') {
            const { query } = req.query;
            console.log('Listing files with query:', query);
            const searchQuery = typeof query === 'string' ? query : undefined;
            const files = await driveService.listFiles(sessionId, searchQuery);
            console.log('Files retrieved:', files);
            return res.status(200).json({ files });
          }
          console.warn('Invalid method for "list" route:', req.method);
          break;
          
      default:
        console.error('Unrecognized route or method:', route, req.method);
        return res.status(404).json({ error: 'Route not found' });
    }
  } catch (error: any) {
    console.error('Error in Drive route:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
