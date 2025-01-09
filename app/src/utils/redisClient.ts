// /server/utils/redisClient.ts
import { createClient } from 'redis';

export const redisClient = createClient();

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

// Connect on import so it's ready for use
redisClient.connect().catch((err) => {
  console.error('Failed to connect to Redis:', err);
});
