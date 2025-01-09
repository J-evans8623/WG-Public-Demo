import { createClient } from 'redis';
import { SessionData } from './types';


const redisClient = createClient();
redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect();

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
  private oauthManager: any; // Avoid importing GoogleOAuthManager directly

  constructor(oauthManager: any) {
    this.oauthManager = oauthManager;
  }

  async createSession(sessionId: string, sessionData: SessionData): Promise<void> {
    console.log('Creating session in Redis:', { sessionId, sessionData });
    try {
      const data = JSON.stringify(sessionData);
      await redisClient.set(sessionId, data, { EX: 3600 }); // Set with 1-hour expiry.
      console.log('Session created successfully');
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    console.log('Retrieving session from Redis:', sessionId);
    try {
      const data = await redisClient.get(sessionId);
      console.log('Session data retrieved:', data);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error retrieving session:', error);
      throw error;
    }
  }

  async destroySession(sessionId: string): Promise<void> {
    console.log('Destroying session in Redis:', sessionId);
    try {
      await redisClient.del(sessionId);
      console.log('Session destroyed successfully');
    } catch (error) {
      console.error('Error destroying session:', error);
      throw error;
    }
  }

  async ensureValidSession(sessionId: string): Promise<SessionData> {
    const session = await this.getSession(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    const currentTime = Date.now();
    if (session.expiresAt <= currentTime) {
      // Token is expired, refresh it
      const refreshedSession = await this.oauthManager.refreshAccessToken(session.refreshToken);
      await this.createSession(sessionId, refreshedSession);
      return refreshedSession;
    }

    // Return the existing valid session
    return session;
  }
}
