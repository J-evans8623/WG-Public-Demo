/**
 * File: /pages/api/auth/[...auth].ts
 * Responsibility: Handle authentication-related routes (login, callback, logout, session).
 * Dependencies:
 *   - /server/auth/oauth.ts for OAuthManager
 *   - /server/auth/session.ts for SessionManager
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleOAuthManager } from '../../src/auth/oauth';
import { RedisSessionManager } from '../../src/auth/session';
import { AuthConfig } from '../../src/auth/types';
import dotenv from 'dotenv';

dotenv.config();

const authConfig: AuthConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: process.env.GOOGLE_REDIRECT_URI!,
  scopes: ['https://www.googleapis.com/auth/drive.file'], // Define necessary scopes
};

const oauthManager = new GoogleOAuthManager(authConfig);
const sessionManager = new RedisSessionManager();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { auth } = req.query;

  switch (auth) {
    case 'login':
      if (req.method === 'GET') {
        const authUrl = await oauthManager.initiateAuth();
        return res.redirect(authUrl);
      }
      break;

    case 'callback':
      if (req.method === 'GET') {
        const { code } = req.query;
        if (!code || typeof code !== 'string') {
          return res.status(400).json({ error: 'Invalid authorization code' });
        }

        try {
          const sessionData = await oauthManager.handleCallback(code);
          res.setHeader('Set-Cookie', `sessionId=${sessionData.userId}; HttpOnly; Secure; Path=/; SameSite=Strict`);
          return res.status(200).json({ message: 'Authentication successful' });
        } catch (error) {
          return res.status(500).json({ error: 'Authentication failed', details: error });
        }
      }
      break;

    case 'logout':
      if (req.method === 'POST') {
        const sessionId = req.cookies.sessionId;
        if (!sessionId) {
          return res.status(400).json({ error: 'No active session' });
        }

        await sessionManager.destroySession(sessionId);
        res.setHeader('Set-Cookie', 'sessionId=; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=0');
        return res.status(200).json({ message: 'Logout successful' });
      }
      break;

    case 'session':
      if (req.method === 'GET') {
        const sessionId = req.cookies.sessionId;
        if (!sessionId) {
          return res.status(404).json({ error: 'Session not found' });
        }

        const sessionData = await sessionManager.getSession(sessionId);
        if (!sessionData) {
          return res.status(404).json({ error: 'Session expired or not found' });
        }

        return res.status(200).json({ session: sessionData });
      }
      break;

    default:
      return res.status(404).json({ error: 'Route not found' });
  }
}
