/**
 * File: /server/auth/session.ts
 * Responsibility: Manage server-side sessions using Redis with added token refresh handling.
 * Dependencies:
 *   - redis client for Redis interactions.
 *   - /server/auth/types.ts for SessionData interface.
 *   - /server/auth/oauth.ts for OAuth token refresh logic.
 */

import { createClient } from 'redis';
import { SessionData } from './types';
import { GoogleOAuthManager } from './oauth';

const redisClient = createClient();
redisClient.connect();

// Instantiate the OAuth manager
const oauthManager = new GoogleOAuthManager({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: process.env.GOOGLE_REDIRECT_URI!,
  scopes: ['https://www.googleapis.com/auth/drive'],
});

/**
 * SessionManager interface defines methods for managing user sessions in Redis.
 */
export interface SessionManager {
  createSession(sessionId: string, sessionData: SessionData): Promise<void>;
  getSession(sessionId: string): Promise<SessionData | null>;
  destroySession(sessionId: string): Promise<void>;
  ensureValidSession(sessionId: string): Promise<SessionData>;
}

/**
 * Redis-based implementation of the SessionManager.
 */
export class RedisSessionManager implements SessionManager {
  /**
   * Stores session data in Redis.
   * @param sessionId - Unique session identifier (key).
   * @param sessionData - Session data to store.
   */
  async createSession(sessionId: string, sessionData: SessionData): Promise<void> {
    const data = JSON.stringify(sessionData);
    await redisClient.set(sessionId, data, { EX: 3600 }); // Set with 1-hour expiry.
  }

  /**
   * Retrieves session data from Redis.
   * @param sessionId - Unique session identifier (key).
   * @returns SessionData if found, otherwise null.
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const data = await redisClient.get(sessionId);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Deletes session data from Redis.
   * @param sessionId - Unique session identifier (key).
   */
  async destroySession(sessionId: string): Promise<void> {
    await redisClient.del(sessionId);
  }

  /**
   * Ensures the session data is valid by checking token expiration and refreshing if necessary.
   * @param sessionId - Unique session identifier (key).
   * @returns Updated SessionData if valid, otherwise throws an error.
   */
  async ensureValidSession(sessionId: string): Promise<SessionData> {
    const session = await this.getSession(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    const currentTime = Date.now();
    if (session.expiresAt <= currentTime) {
      // Token is expired, refresh it
      const refreshedSession = await oauthManager.refreshAccessToken(session.refreshToken);
      await this.createSession(sessionId, refreshedSession);
      return refreshedSession;
    }

    // Return the existing valid session
    return session;
  }
}
