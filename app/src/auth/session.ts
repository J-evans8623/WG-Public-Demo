/**
 * File: /server/auth/session.ts
 * Responsibility: Manage server-side sessions using Redis.
 * Dependencies:
 *   - redis client for Redis interactions.
 *   - /server/auth/types.ts for SessionData interface.
 */

import { createClient } from 'redis';
import { SessionData } from './types';

const redisClient = createClient();
redisClient.connect();

/**
 * SessionManager interface defines methods for managing user sessions in Redis.
 */
export interface SessionManager {
  createSession(sessionId: string, sessionData: SessionData): Promise<void>;
  getSession(sessionId: string): Promise<SessionData | null>;
  destroySession(sessionId: string): Promise<void>;
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
}
