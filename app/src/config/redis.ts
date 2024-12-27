/**
 * config/redis.ts
 * 
 * Configures the Redis client for caching.
 * 
 * Responsibilities:
 * - Initializes a Redis client instance using environment variables for configuration.
 * - Handles connection events (e.g., success, error).
 * - Provides a single instance of the Redis client for use across the application.
 */

import Redis from 'ioredis';

class RedisClient {
  private client: Redis;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    // Initialize Redis client
    this.client = new Redis(redisUrl);

    // Event listeners for connection status
    this.client.on('connect', () => {
      console.log('Connected to Redis successfully.');
    });

    this.client.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
  }

  /**
   * Retrieves the Redis client instance.
   * 
   * @returns Redis - The Redis client instance.
   */
  public getClient(): Redis {
    return this.client;
  }
}

// Export a singleton instance of RedisClient
const instance = new RedisClient();
export default instance;
