/**
 * @file server/config/redisConfig.ts
 * @description
 * Centralized Redis configuration parser.
 * PATCH: Now prioritizes REDIS_URL for Docker compatibility.
 * If REDIS_URL is present, it parses the host/port from it.
 * Otherwise falls back to REDIS_HOST/REDIS_PORT.
 */

import { URL } from 'url';

export interface RedisConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  tls?: boolean;
}

export const getRedisConfig = (): RedisConfig => {
  // 1. Priority: REDIS_URL (Docker/Cloud standard)
  if (process.env.REDIS_URL) {
    try {
      const parsed = new URL(process.env.REDIS_URL);
      return {
        host: parsed.hostname,
        port: Number(parsed.port) || 6379,
        username: parsed.username || 'default',
        password: parsed.password || undefined,
        tls: parsed.protocol === 'rediss:',
      };
    } catch (e) {
      console.error('Invalid REDIS_URL, falling back to individual vars');
    }
  }

  // 2. Fallback: Individual variables (Local dev / legacy)
  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
    username: 'default',
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true',
  };
};