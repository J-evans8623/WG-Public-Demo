// lib/redis.ts
/***************************************************************************************************
 * @file lib/redis.ts
 * @description
 *   Centralized, production-ready Redis client factory used by all cache and rate-gate utilities.
 *   This module enforces a single shared connection per process (including dev hot-reload), hides
 *   environment-specific connection details (Docker, local Redis, or Google Cloud Memorystore),
 *   and applies safe timeouts/retry strategies to survive transient network hiccups. It supports:
 *     1) REDIS_URL (preferred, e.g., redis://:pass@host:6379 or rediss://host:port for TLS),
 *     2) host/port/password-based configuration via REDIS_HOST, REDIS_PORT, REDIS_PASSWORD,
 *     3) optional TLS via REDIS_TLS=true,
 *     4) low-noise but purposeful logging for connect/error/ready/close lifecycle events.
 *
 *   By forcing every module to import the client from this file, we make the cache/rate gate layer
 *   entirely swappable: pointing to Memorystore in production becomes a pure environment change,
 *   with zero call-site edits. All commands are O(1) over key size; networking dominates latency.
 *   This module contains no application policy; it is only a connectivity and lifecycle boundary.
 *
 * Responsibilities:
 *   - Build and expose a singleton Redis client for the whole process.
 *   - Normalize environment configuration across local/dev/prod targets.
 *   - Provide minimal lifecycle logs and a fast health check utility.
 *   - Fail-open helpers (where applicable) are implemented in callers.
 ***************************************************************************************************/

import Redis, { RedisOptions } from 'ioredis'; // update - 1

let _client: Redis | null = null;

/**
 * getRedis
 * @description
 *   Returns a singleton ioredis client. Reuses an existing connection if present to keep resource
 *   usage low and avoid exhausting connection limits during local hot-reloads. Connection details
 *   are derived from environment variables for maximum portability. Time complexity per call is
 *   O(1); the only cost is a pointer check when already initialized. Network I/O dominates cost.
 */
export function getRedis(): Redis {
  if (_client) return _client;

  // [3101] Build connection options from env with safe defaults
  const {
    REDIS_URL,
    REDIS_HOST = '127.0.0.1',
    REDIS_PORT = '6379',
    REDIS_PASSWORD,
    REDIS_TLS,
    REDIS_CONNECT_TIMEOUT_MS = '8000',
    REDIS_COMMAND_TIMEOUT_MS = '5000',
    REDIS_MAX_RETRY_MS = '120000',
  } = process.env;

  const connectTimeout = Number(REDIS_CONNECT_TIMEOUT_MS);
  const commandTimeout = Number(REDIS_COMMAND_TIMEOUT_MS);
  const maxRetryTime = Number(REDIS_MAX_RETRY_MS);

  const opts: RedisOptions = REDIS_URL // update - 2
    ? {
        lazyConnect: false,
        enableReadyCheck: true,
        connectTimeout,
        commandTimeout,
        maxRetriesPerRequest: null, // allow retry strategy to govern
        retryStrategy: (times: number): number | null => { // update - 3
          const delay = Math.min(times * 200, 2000);
          const elapsed = times * delay;
          if (elapsed > maxRetryTime) return null; // stop retrying
          return delay;
        },
        tls: REDIS_URL.startsWith('rediss://') ? {} : undefined,
      }
    : {
        host: REDIS_HOST,
        port: Number(REDIS_PORT),
        password: REDIS_PASSWORD || undefined,
        lazyConnect: false,
        enableReadyCheck: true,
        connectTimeout,
        commandTimeout,
        maxRetriesPerRequest: null,
        retryStrategy: (times: number): number | null => { // update - 4
          const delay = Math.min(times * 200, 2000);
          const elapsed = times * delay;
          if (elapsed > maxRetryTime) return null;
          return delay;
        },
        tls: REDIS_TLS === 'true' ? {} : undefined,
      };

  _client = REDIS_URL ? new Redis(REDIS_URL, opts) : new Redis(opts);

  // [3102] Lifecycle logs (low-noise)
  _client.on('connect', () => console.log('lib/redis.ts [3102] connect'));
  _client.on('ready',   () => console.log('lib/redis.ts [3103] ready'));
  _client.on('close',   () => console.log('lib/redis.ts [3104] close'));
  _client.on('reconnecting', (delayMs: number) => console.log('lib/redis.ts [3105] reconnecting', delayMs)); // update - 5
  _client.on('error',   (err) => console.warn('lib/redis.ts [3106] error', err?.message));

  return _client;
}

/**
 * pingRedis
 * @description
 *   Lightweight health check to verify the connection is alive. Useful in boot diagnostics and
 *   readiness probes. Time complexity is O(1). If Redis is unavailable, the caller can choose to
 *   fail-open at higher layers (e.g., skip cache, proceed with Firestore).
 */
export async function pingRedis(): Promise<boolean> {
  try {
    const client = getRedis();
    const res = await client.ping();
    const ok = res?.toUpperCase() === 'PONG';
    console.log('lib/redis.ts [3107] ping', { ok });
    return ok;
  } catch (e) {
    console.warn('lib/redis.ts [3108] ping failed', e);
    return false;
  }
}
