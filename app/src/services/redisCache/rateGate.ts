// lib/rateGate.ts
/***************************************************************************************************
 * @file lib/rateGate.ts
 * @description
 *   Lightweight Redis-backed rate-gating utilities to cheaply throttle abusive bursts **before**
 *   touching Firestore. Two primitives are provided:
 *     1) fixedWindowTry: classic fixed window counter ("N requests per windowSec"),
 *     2) tokenBucketTry: smoother limiter that refills over time (capacity/refill rate).
 *   These are **non-authoritative** pre-checks: if they ALLOW, you still perform your existing,
 *   authoritative Firestore entitlement/rate checks. If they BLOCK, you can 429 early to protect
 *   backends. If Redis is unavailable, helpers fail-open. All operations are O(1) and atomic.
 *
 * Responsibilities:
 *   - Provide safe, atomic rate-gating primitives usable from API routes.
 *   - Keep behavior predictable and debuggable with crisp return values.
 *   - Log only critical checkpoints (allow/block/errors) with trace codes.
 ***************************************************************************************************/

import type Redis from 'ioredis';
import { getRedis } from './redis';
import { gateFixedWindowKey, gateTokenBucketKey } from './cacheKeys';

export type GateDecision = {
  allowed: boolean;
  remaining: number;          // remaining tokens/slots in current window/bucket (-1 if unknown)
  retryAfterSec?: number;     // seconds until likely success (advisory)
  key?: string;               // the key consulted for observability
};

/**
 * fixedWindowTry
 * @description
 *   Atomic "N requests per windowSec" limiter using INCR + EXPIRE. Returning {allowed:false} signals
 *   a quick 429 opportunity. If the key is new, we set its expiry to the window size so it resets
 *   naturally. Time complexity is O(1), and the operation is atomic per Redis key.
 */
export async function fixedWindowTry(
  service: string,
  subject: string,
  limit: number,
  windowSec: number,
  nowMs: number = Date.now()
): Promise<GateDecision> {
  const client: Redis = getRedis();
  try {
    const windowStartSec = Math.floor(nowMs / 1000 / windowSec) * windowSec;
    const key = gateFixedWindowKey(service, subject, windowStartSec, windowSec);
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, windowSec);

    const remaining = Math.max(0, limit - count);
    if (count > limit) {
      const ttl = await client.ttl(key);
      console.log('lib/rateGate.ts [5201] BLOCK fw', { service, subject, key, ttl });
      return { allowed: false, remaining: 0, retryAfterSec: ttl > 0 ? ttl : windowSec, key };
    }

    console.log('lib/rateGate.ts [5202] ALLOW fw', { service, subject, key, count, remaining });
    return { allowed: true, remaining, key };
  } catch (e) {
    // Fail-open: do not break the request if Redis is down.
    console.warn('lib/rateGate.ts [5203] fw error fail-open', { service, subject, err: (e as Error)?.message });
    return { allowed: true, remaining: -1 };
  }
}

// Pre-load and cache a small Lua script for token bucket to keep operations atomic and O(1).
// Fields stored at key:
//   - tokens (float)
//   - ts (last refill unix ms)
const TOKEN_BUCKET_LUA = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_per_sec = tonumber(ARGV[2])
local now_ms = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])

if tokens == nil or ts == nil then
  tokens = capacity
  ts = now_ms
else
  local delta_ms = math.max(0, now_ms - ts)
  local refill = (delta_ms / 1000.0) * refill_per_sec
  tokens = math.min(capacity, tokens + refill)
  ts = now_ms
end

local allowed = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'ts', ts)
-- Keep the bucket around for a while; it’s small (2 fields).
redis.call('PEXPIRE', key, 3600000)

return { allowed, tokens }`;

let _tbSha: string | null = null;

/**
 * tokenBucketTry
 * @description
 *   Smoother limiter that allows short bursts while honoring a steady refill rate. Typical params:
 *   capacity=8, refillPerSec=8/300 (8 tokens per 5 minutes). If Redis fails, the function fails-open
 *   to avoid disrupting traffic. Time complexity is O(1). The LUA script ensures atomicity.
 */
export async function tokenBucketTry(
  service: string,
  subject: string,
  capacity: number,
  refillPerSec: number,
  cost: number = 1,
  nowMs: number = Date.now()
): Promise<GateDecision> {
  const client: Redis = getRedis();
  const key = gateTokenBucketKey(service, subject);

  try {
    // Load script once, then use EVALSHA
    if (!_tbSha) {
      try {
        const sha = await client.script('LOAD', TOKEN_BUCKET_LUA) as unknown as string; // update - 1
        _tbSha = sha; // update - 1
        console.log('lib/rateGate.ts [5204] tb script loaded', { sha: _tbSha });
      } catch (e) {
        console.warn('lib/rateGate.ts [5205] tb script load failed; will EVAL', (e as Error)?.message);
      }
    }

    let result: any;
    if (_tbSha) {
      result = await client.evalsha(_tbSha, 1, key, capacity, refillPerSec, nowMs, cost);
    } else {
      result = await client.eval(TOKEN_BUCKET_LUA, 1, key, capacity, refillPerSec, nowMs, cost);
    }

    const allowed = Number(result?.[0]) === 1;
    const tokensLeft = Math.max(0, Math.floor(Number(result?.[1] ?? 0)));

    if (!allowed) {
      // Compute advisory retryAfter: how long to accrue enough tokens for `cost`.
      const needed = Math.max(0, cost - tokensLeft);
      const retryAfterSec = Math.ceil(needed / Math.max(0.0001, refillPerSec));
      console.log('lib/rateGate.ts [5206] BLOCK tb', { service, subject, key, tokensLeft, retryAfterSec });
      return { allowed: false, remaining: tokensLeft, retryAfterSec, key };
    }

    console.log('lib/rateGate.ts [5207] ALLOW tb', { service, subject, key, tokensLeft });
    return { allowed: true, remaining: tokensLeft, key };
  } catch (e) {
    console.warn('lib/rateGate.ts [5208] tb error fail-open', { service, subject, err: (e as Error)?.message });
    return { allowed: true, remaining: -1 };
  }
}
