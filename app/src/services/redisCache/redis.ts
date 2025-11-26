// bloom-maps/app/src/services/redisCache/redis.ts
import Redis, { RedisOptions } from 'ioredis';

// -----------------------------------------------------------------------------
// GLOBAL SINGLETON PATTERN
// This prevents Next.js from creating multiple connections during
// hot-reloading or serverless function warm-ups.
// -----------------------------------------------------------------------------
const globalForRedis = global as unknown as { bloomRedis: Redis };

export function getRedis(): Redis {
  // 1. Check Global Scope first
  if (globalForRedis.bloomRedis) {
    return globalForRedis.bloomRedis;
  }

  // 2. Safe Configuration Extraction (Prevents NaN)
  const {
    REDIS_URL,
    REDIS_HOST = '127.0.0.1',
    REDIS_PORT = '6379',
    REDIS_PASSWORD,
    REDIS_TLS,
    REDIS_CONNECT_TIMEOUT_MS,
    REDIS_COMMAND_TIMEOUT_MS,
  } = process.env;

  // Use explicit fallbacks so we never pass NaN
  const connectTimeout = REDIS_CONNECT_TIMEOUT_MS ? Number(REDIS_CONNECT_TIMEOUT_MS) : 10000; // 10s
  const commandTimeout = REDIS_COMMAND_TIMEOUT_MS ? Number(REDIS_COMMAND_TIMEOUT_MS) : 5000; // 5s

  // 3. Define Options
  const commonOpts: RedisOptions = {
    // FORCE IPv4: This matches your docker-compose fix and ensures
    // the internal client options are aligned.
    family: 4,
    
    lazyConnect: false,
    enableReadyCheck: true,
    connectTimeout,
    commandTimeout,
    
    // CRITICAL: Keep commands in memory if Redis is briefly down (e.g. BGSAVE)
    // failing immediately causes the "Command Timed Out" errors you saw.
    enableOfflineQueue: true, 
    
    // CRITICAL: Retry Strategy
    // We NEVER return null (which kills the client). We just back off.
    maxRetriesPerRequest: null, // Let retryStrategy handle it
    retryStrategy: (times: number) => {
      // Exponential backoff: 50, 100, 200... capped at 3 seconds
      // We keep retrying forever because a server needs its DB.
      const delay = Math.min(times * 50, 3000);
      return delay;
    },
  };

  let client: Redis;

  if (REDIS_URL) {
    // Note: Since you added ?family=4 to your connection string in Docker,
    // that will take precedence, but we merge options just in case.
    const isTls = REDIS_URL.startsWith('rediss://');
    client = new Redis(REDIS_URL, {
      ...commonOpts,
      tls: isTls ? {} : undefined,
    });
  } else {
    client = new Redis({
      ...commonOpts,
      host: REDIS_HOST,
      port: Number(REDIS_PORT),
      password: REDIS_PASSWORD || undefined,
      tls: REDIS_TLS === 'true' ? {} : undefined,
    });
  }

  // 4. Lifecycle Logs
  client.on('connect', () => console.log('✅ [Redis] Connection initializing...'));
  client.on('ready',   () => console.log('🚀 [Redis] Client Ready (IPv4)'));
  client.on('close',   () => console.warn('⚠️ [Redis] Connection Closed'));
  client.on('reconnecting', (t:any) => console.log(`🔄 [Redis] Reconnecting in ${t}ms...`));
  
  // Handling the "error" event is mandatory to prevent node process exit
  client.on('error', (err) => {
    // Suppress the "ECONNREFUSED" spam logs slightly, but log critical failures
    console.error('❌ [Redis] Error:', err.message);
  });

  // 5. Save to Global
  if (process.env.NODE_ENV !== 'production') {
     globalForRedis.bloomRedis = client;
  } else {
     // In production, we also want to cache it, but usually the process 
     // management is more stable. We assign it here too to be safe 
     // against multiple imports.
     globalForRedis.bloomRedis = client;
  }

  return client;
}

/**
 * Health Check
 */
export async function pingRedis(): Promise<boolean> {
  try {
    const client = getRedis();
    // Use a short timeout for the ping specifically so we don't hang health checks
    const res = await Promise.race([
      client.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Ping timeout')), 1000))
    ]);
    return (res as string) === 'PONG';
  } catch (e) {
    console.warn('⚠️ [Redis] Ping Failed:', e);
    return false;
  }
}