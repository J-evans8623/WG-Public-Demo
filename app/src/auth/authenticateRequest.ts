// bloom-maps/app/src/utils/authenticateRequest.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { parse } from 'cookie';
import { sessionManager } from '@/app/src/auth/singletons';

export async function authenticateRequest(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
  const sessionId = cookies.sessionId;

  if (!sessionId) {
    console.warn('Unauthorized access: No session found.');
    res.status(401).json({ error: 'Unauthorized: No session found' });
    return null;
  }

  try {
    const sessionData = await sessionManager.ensureValidSession(sessionId);
    return sessionData;
  } catch (error) {
    console.error('Session validation failed:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    return null;
  }
}
