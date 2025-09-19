// lib/cacheAside.ts
/***************************************************************************************************
 * @file lib/cacheAside.ts
 * @description
 *   Generic, JSON-based cache-aside helper with dogpile protection and optional negative caching.
 *   Callers provide a fully formed key (see cacheKeys.ts), a TTL, and a loader function that fetches
 *   authoritative data from the system of record (e.g., Firestore). The helper will:
 *     (1) Attempt a GET; on hit, JSON-decode and return immediately.
 *     (2) On miss, attempt to take a short NX lock to avoid thundering herds.
 *         • If lock acquired → run loader → SETEX; store a short-lived sentinel on null.
 *         • If lock not acquired → briefly backoff and re-GET a few times; fail-open to loader.
 *   Serialization is stable JSON; the null sentinel is `{ __nc: true }`. All operations are O(1).
 *
 * Responsibilities:
 *   - Provide consistent cache-aside behavior with minimal boilerplate at call sites.
 *   - Enforce short lock-based herd protection for high-QPS hot keys.
 *   - Support negative caching to protect backends from repeated misses.
 *   - Keep logging concise and actionable with unique trace codes.
 ***************************************************************************************************/

import type Redis from 'ioredis';
import { getRedis } from './redis';
import { addJitter, NEGATIVE_TTL } from './cachePolicies';

type CacheAsideOptions<T> = {
  swrSec?: number;                 // optional SWR buffer (not used to serve stale here; used for TTL tune)
  negativeTtlSec?: number;         // TTL for negative cache entries (null result)
  skipCache?: boolean;             // bypass cache entirely (e.g., for debugging)
  serialize?: (v: T) => string;    // custom serializer (defaults to JSON.stringify)
  deserialize?: (s: string) => T;  // custom deserializer (defaults to JSON.parse)
  lockTtlSec?: number;             // lock TTL (default 10)
  lockRetryMs?: number;            // wait between retries when not owning lock
  lockRetryMax?: number;           // how many retries before fail-open
};

const NULL_SENTINEL = { __nc: true };

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * cacheAside
 * @description
 *   Core cache-aside implementation. Provides a fast-path GET, an anti-dogpile lock, and safe
 *   JSON serialization. If the loader yields null/undefined, a negative-cache sentinel is written
 *   with a short TTL to prevent request storms on missing resources. Time complexity is O(1) for
 *   Redis operations; loader complexity is application-specific. Logs capture hit/miss/lock cases.
 */
export async function cacheAside<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T | null | undefined>,
  opts: CacheAsideOptions<T> = {}
): Promise<T | null> {
  const client: Redis = getRedis();
  const {
    negativeTtlSec = NEGATIVE_TTL.DEFAULT,
    skipCache = false,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    lockTtlSec = 10,
    lockRetryMs = 25,
    lockRetryMax = 6,
  } = opts;

  if (skipCache) {
    console.log('lib/cacheAside.ts [4111] skipCache=true', { key });
    const fresh = await loader();
    return fresh ?? null;
  }

  // [4112] Fast path: GET
  const cached = await client.get(key);
  if (cached != null) {
    try {
      const parsed = deserialize(cached);
      if (parsed && typeof parsed === 'object' && (parsed as any).__nc === true) {
        console.log('lib/cacheAside.ts [4112] hit NEG', { key });
        return null;
      }
      console.log('lib/cacheAside.ts [4113] hit', { key });
      return parsed as T;
    } catch (e) {
      console.warn('lib/cacheAside.ts [4114] parse error; treating as miss', { key, err: (e as Error)?.message });
    }
  }

  // [4115] Miss → anti-dogpile lock
  const lockKey = `${key}:lock`;
  const gotLock = await client.set(lockKey, '1', 'EX', lockTtlSec, 'NX');
  if (gotLock === 'OK') {
    try {
      const fresh = await loader();
      const ttl = addJitter(ttlSec);
      if (fresh == null) {
        await client.setex(key, Math.max(1, negativeTtlSec), JSON.stringify(NULL_SENTINEL));
        console.log('lib/cacheAside.ts [4116] miss→load→NEG set', { key });
        return null;
      } else {
        await client.setex(key, ttl, serialize(fresh as T));
        console.log('lib/cacheAside.ts [4117] miss→load→SET', { key, ttl });
        return fresh as T;
      }
    } finally {
      // Let the lock expire naturally; explicit DEL is optional and can cause extra chatter.
    }
  }

  // [4118] Lock not owned → short backoff re-GETs, then fail-open
  for (let i = 0; i < lockRetryMax; i++) {
    await sleep(lockRetryMs);
    const again = await client.get(key);
    if (again != null) {
      try {
        const parsed = deserialize(again);
        if (parsed && typeof parsed === 'object' && (parsed as any).__nc === true) {
          console.log('lib/cacheAside.ts [4119] follower NEG', { key, i });
          return null;
        }
        console.log('lib/cacheAside.ts [4120] follower hit', { key, i });
        return parsed as T;
      } catch {
        // ignore and continue
      }
    }
  }

  console.log('lib/cacheAside.ts [4121] miss→follower fail-open loader', { key });
  const fallback = await loader();
  return fallback ?? null;
}
