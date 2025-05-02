/**
 * File: /pages/api/auth/[...auth].ts
 * Responsibility: Handle authentication-related routes (login, callback, logout, session).
 * Dependencies:
 *   - /server/auth/oauth.ts for OAuthManager
 *   - /server/auth/session.ts for SessionManager
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleOAuthManager } from '../src/auth/oauth';
import { RedisSessionManager } from '../src/auth/session';
import { AuthConfig } from '../src/auth/types';
import dotenv from 'dotenv';
import { parse } from 'cookie';
import crypto from 'crypto';


dotenv.config();

const authConfig: AuthConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: process.env.GOOGLE_REDIRECT_URI!,
  scopes: [
    'openid',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/drive.file'
  ]
};

const oauthManager = new GoogleOAuthManager(authConfig);
const sessionManager = new RedisSessionManager(oauthManager);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { auth } = req.query;

  // Ensure `auth` is always an array
  const route = Array.isArray(auth) ? auth[0] : auth;


  switch (route) {
    case 'login':
      if (req.method === 'GET') { // Use GET for direct redirection
        ////console.log('Initiating login process...');
        try {
          const authUrl = await oauthManager.initiateAuth();
          ////console.log('Redirecting to Auth URL:', authUrl);
          return res.redirect(authUrl); // Redirects the user to Google's auth page
        } catch (error) {
          console.error('Error during login:', error);
          return res.status(500).json({ error: 'Failed to initiate login' });
        }
      } 
      
      break;

    case 'callback':
      if (req.method === 'GET') {
        ////console.log('-------------[...auth].ts Handling OAuth callback...');
        const { code, state } = req.query;
        ////console.log('Received authorization code:', code);
        ////console.log('Received state:', state);

        if (!code || typeof code !== 'string' || !state || typeof state !== 'string') {
          return res.status(400).send(`
            <script>
              window.opener.postMessage({ type: 'AUTH_ERROR', error: 'Invalid authorization code' }, window.location.origin);
              window.close();
            </script>
          `);
        }

        try {
          const sessionData = await oauthManager.handleCallback(code, state);
          ////console.log('Session data created:', sessionData);
          const sessionId = crypto.randomUUID();
          await sessionManager.createSession(sessionId, sessionData);

          res.setHeader(
            'Set-Cookie',
            `sessionId=${sessionId}; HttpOnly; Secure; Path=/; SameSite=Strict`
          );
          return res.send(`
            <script>
              window.opener.postMessage({ type: 'AUTH_SUCCESS' }, window.location.origin);
              window.close();
            </script>
          `);
        } catch (error) {
          console.error('Error handling callback:', error);
          return res.status(500).send(`
            <script>
              window.opener.postMessage({ type: 'AUTH_ERROR', error: 'Authentication failed' }, window.location.origin);
              window.close();
            </script>
          `);
        }
      }
      break;

    case 'logout':
      if (req.method === 'POST') {
        ////console.log('Handling logout...');
        const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
        const sessionId = cookies.sessionId;
        ////console.log('Session ID from cookies:', sessionId);

        if (!sessionId) {
          console.error('No active session found');
          return res.status(400).json({ error: 'No active session' });
        }

        try {
          await sessionManager.destroySession(sessionId);
          ////console.log('Session destroyed:', sessionId);

          res.setHeader(
            'Set-Cookie',
            'sessionId=; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=0'
          );
          return res.status(200).json({ message: 'Logout successful' });
        } catch (error) {
          console.error('Error during logout:', error);
          return res.status(500).json({ error: 'Failed to log out' });
        }
      }
      break;

      case 'session':
        if (req.method === 'GET') {
          ////console.log('------[...auth].ts session endpoint : Fetching session data...------');
          const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
          const sessionId = cookies.sessionId; // Safely access cookies
          ////console.log('Session ID from cookies:', sessionId);
      
          if (!sessionId) {
            console.warn('No session ID provided. User might not be signed in.');
            return res.status(200).json({ session: null }); // Return null session
          }
      
          try {
            const sessionData = await sessionManager.getSession(sessionId);
            ////console.log('Session data retrieved:', sessionData);
      
            if (!sessionData) {
              console.warn('Session expired or not found');
              return res.status(200).json({ session: null }); // Return null session
            }
      
            return res.status(200).json({ session: sessionData });
          } catch (error) {
            console.error('Error fetching session data:', error);
            return res.status(500).json({ error: 'Failed to fetch session data' });
          }
        }
        break;
      

    default:
      console.error('Invalid route accessed');
      return res.status(404).json({ error: 'Route not found' });
  }
}
