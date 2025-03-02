// /server/utils/redisClient.ts

import { getRedisConfig } from './redisConfig';
import Redis from 'ioredis';

const config = getRedisConfig();

// Create Redis client using ioredis with the same configuration pattern as y-websocket-server.js
export const redisClient = new Redis({
  host: config.host,
  port: config.port,
  username: config.username,
  password: config.password,
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('Successfully connected to Redis');
});

export default redisClient;