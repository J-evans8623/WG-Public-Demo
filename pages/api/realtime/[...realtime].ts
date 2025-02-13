// pages/api/[...realtime].ts

/**
 * @file /pages/api/[...realtime].ts
 * @description
 * Handles HTTP requests for token generation.
 *
 * Dependencies:
 * - /utils/webSocketToken.ts for token operations.
 * - /utils/SessionDocumentMapper.ts for session-document mapping.
 * - authenticateRequest for session validation.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { generateWebSocketToken } from '@/app/src/utils/webSocketToken';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';

// Utility to parse the path segments
const getPathSegments = (req: NextApiRequest): string[] => {
  const { realtime } = req.query;
  if (Array.isArray(realtime)) {
    return realtime;
  }
  return realtime ? [realtime] : [];
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

        // Authenticate the incoming request using the centralized helper.
        const sessionData = await authenticateRequest(req, res);
        if (!sessionData) return; // If authentication fails, authenticateRequest already handles the response.

        // Generate a WebSocket token using authenticated session data (using userId or sessionId as needed)
        console.log(`Generating WebSocket token for userId=${sessionData.userId}, documentId=${documentId}...`);
        try {
          const token = generateWebSocketToken(sessionData.userId, documentId);
          console.log('Generated WebSocket token:', token);
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
      return res.status(404).json({ error: 'Route not found' });
  }
}
