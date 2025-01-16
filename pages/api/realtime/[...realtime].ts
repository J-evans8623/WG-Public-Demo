// pages/api/[...realtime].ts

/**
 * @file /pages/api/[...realtime].ts
 * @description
 * Handles HTTP requests for token generation.
 *
 * Dependencies:
 * - /utils/webSocketToken.ts for token operations.
 * - /utils/SessionDocumentMapper.ts for session-document mapping.
 * - cookie for parsing cookies.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import {
  addSessionToDocument,
  getDocumentBySession,
} from '@/app/src/utils/SessionDocumentMapper';
import { generateWebSocketToken } from '@/app/src/utils/webSocketToken';
import cookie from 'cookie';

// Utility to parse the path segments
const getPathSegments = (req: NextApiRequest): string[] => {
  const { realtime } = req.query;
  if (Array.isArray(realtime)) {
    return realtime;
  }
  return realtime ? [realtime] : [];
};


const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.split('=').map((v) => v.trim());
    if (key && value) acc[key] = decodeURIComponent(value);
    return acc;
  }, {} as Record<string, string>);
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const pathSegments = getPathSegments(req);
  const route = pathSegments[0] || '';

  switch (route) {
    case 'token':
      if (req.method === 'POST') {
        console.log('POST /api/realtime/token: Attempting to generate WebSocket token...');
        const { documentId } = req.body;

        if (!documentId) {
          console.warn('No documentId provided in request body.');
          return res.status(400).json({ error: 'Missing documentId' });
        }

        try {
          console.log('About to read cookie values...', req.headers.cookie);
          const cookies = req.headers.cookie ?parseCookies(req.headers.cookie): {}; // The error appears to occur on this line, the console log statement never prints the returned value
          console.log(`Printing cookie.parse output :  ${cookies}`);
          const sessionId = cookies.sessionId;

          if (!sessionId) {
            console.warn('No sessionId found in cookies.');
            return res.status(401).json({ error: 'Unauthorized: No session found' });
          }

          console.log(`Validating if session ${sessionId} has access to document ${documentId}...`);
          const associatedDocumentId = await getDocumentBySession(sessionId);
          if (associatedDocumentId !== documentId) {
            console.warn(
              `Session ${sessionId} is mapped to document ${associatedDocumentId}, not ${documentId}. Access denied.`
            );
            return res
              .status(403)
              .json({ error: 'Session does not have access to the specified document' });
          }

          console.log(`Generating WebSocket token for sessionId=${sessionId}, documentId=${documentId}...`);
          const token = generateWebSocketToken(sessionId, documentId);
          console.log('Generated Token : ',token);

          return res.status(200).json({ token });
        } catch (error: any) {
          console.error('Error generating WebSocket token:', error);
          return res.status(500).json({ error: 'Internal Server Error' });
        }
      } else {
        console.log(`Invalid method for /api/realtime/token: ${req.method}`);
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
      }

    default:
      res.status(404).json({ error: 'Route not found' });
  }
}
