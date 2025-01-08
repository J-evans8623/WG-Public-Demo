/**
 * File: /server/utils/rateLimit.ts
 * Responsibility: Implement rate limiting using Redis for autosave operations.
 * Dependencies:
 *   - redis client for Redis interactions.
 */

import { createClient } from "redis";

const redisRateClient = createClient();
redisRateClient.connect();

/**
 * Checks if the user has exceeded the rate limit for a given action.
 * @param key - Unique identifier for the user and action (e.g., `autosave:userId`).
 * @param limit - Maximum allowed requests in the time window.
 * @param windowSeconds - Time window in seconds.
 * @returns Boolean indicating if the action is allowed.
 */
export const isRateLimited = async (key: string, limit: number, windowSeconds: number): Promise<boolean> => {
  const currentCount = await redisRateClient.incr(key);

  if (currentCount === 1) {
    // Set expiry on the key for the sliding window
    await redisRateClient.expire(key, windowSeconds);
  }

  return currentCount > limit;
};
