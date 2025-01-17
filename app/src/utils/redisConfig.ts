// /server/config/redisConfig.ts

export interface RedisConfig {
    host: string;
    port: number;
    username: string;
    password?: string;
  }
  
  export const getRedisConfig = (): RedisConfig => ({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
    username: 'default', // Required username
    password: process.env.REDIS_PASSWORD || undefined,
  });