/***************************************************************************************************
 * @file redisCache/userCache.ts
 * @description
 *   Production-ready, user-centric caching utilities that provide versioned, read-through access to
 *   user profile data, usage snapshots, and composite validation results. This module isolates all
 *   Redis key construction, TTL policy, and version bump semantics so application services can just
 *   import a tiny API. The central idea mirrors ACL caching: every user (by email) has a monotonic
 *   version counter in Redis (`user:v:{email}`), and all cached reads embed that version in their
 *   keys. Writers simply `INCR` the version after a successful Firestore mutation. That makes
 *   invalidation O(1): readers shift to new keys automatically without SCAN/DEL. We also include a
 *   compact “validation result” micro-cache for expensive premium checks.
 *
 *   The module exposes:
 *     1) `getUserVersion(email)` and `bumpUserVersion(email)` for versioning,
 *     2) `cacheReadUserProfile(email, loader)` and `cacheReadUserUsage(email, loader)` for data,
 *     3) `readValidationResult(service,email,ver)` / `writeValidationResult(...)` micro-cache helpers.
 *
 *   Design principles:
 *     - Firestore remains the source of truth; Redis is an accelerator.
 *     - Fail-open posture: if Redis is down, we still call loaders and return fresh data.
 *     - Purposeful logs with unique trace codes for hit/miss and version bumps.
 *     - All Redis operations are O(1); network dominates latency.
 *
 *   This file is intentionally policy-light. TTLs, SWR, and negative TTLs are sourced from
 *   `lib/cachePolicies.ts`. Key formats come from `lib/cacheKeys.ts`. Higher layers decide when to
 *   bump versions (typically right after successful Firestore writes).
 ***************************************************************************************************/

import { getRedis } from './redis';
import { cacheAside } from './cacheAside';
import { CACHE_TTL, SWR_TTL, NEGATIVE_TTL } from './cachePolicies';
import {
  userVersionKey,
  userProfileKey,
  userUsageKey,
  validationResultKey,
} from './cacheKeys';

import type { ValidationResult } from '@/app/src/services/validatePremiumAccess';
import type { UserProfile, UserUsage } from '@/app/src/services/userService';

/**
 * getUserVersion
 * @description
 *   Read the current user version from Redis; defaults to 1 if missing or on error. Callers include
 *   this value in cache keys to tie reads to the latest write. Time complexity is O(1).
 */
export async function getUserVersion(email: string): Promise<number> {
  const client = getRedis();
  try {
    const raw = await client.get(userVersionKey(email));
    const ver = raw ? Number(raw) : 0; // ← default 0 so first INCR moves 0→1
    return Number.isFinite(ver) && ver >= 0 ? ver : 0;
  } catch { return 0; }
}

/**
 * bumpUserVersion
 * @description
 *   Increment the per-user version counter. Call this immediately after successful Firestore writes
 *   that affect profile/usage/validation semantics. Readers will automatically shift to fresh keys.
 *   Returns the new version for observability. Time complexity is O(1).
 */
export async function bumpUserVersion(email: string): Promise<number> {
  const client = getRedis();
  try {
    const ver = await client.incr(userVersionKey(email));
    console.log('lib/userCache.ts [6603] bumpUserVersion', { email, ver });
    return ver;
  } catch (e) {
    console.warn('lib/userCache.ts [6604] bumpUserVersion failed', { email, err: (e as Error)?.message });
    return -1;
  }
}

/**
 * cacheReadUserProfile
 * @description
 *   Versioned, read-through cache for a user profile. The caller provides a loader that fetches the
 *   authoritative data (e.g., Firestore read/create). This helper constructs the versioned key and
 *   applies cache-aside with negative-cache protection for nulls. Time complexity is O(1) for Redis.
 */
export async function cacheReadUserProfile(
  email: string,
  loader: () => Promise<UserProfile | null | undefined>
): Promise<UserProfile | null> {
  const ver = await getUserVersion(email);
  const key = userProfileKey(ver, email);

  const wrapped = async () => {
    const p = await loader();
    if (!p) {
      console.log('lib/userCache.ts [6605] profile loader→NEG', { email, ver });
      return null;
    }
    console.log('lib/userCache.ts [6606] profile loader→OK', { email, ver, tier: p.subscriptionTier, acct: p.accountType });
    return p;
  };

  const hit = await cacheAside<UserProfile>(
    key,
    CACHE_TTL.USER_PROFILE,
    wrapped,
    { negativeTtlSec: NEGATIVE_TTL.DEFAULT }
  );

  if (hit == null) {
    console.log('lib/userCache.ts [6607] profile NEG hit', { email, ver, key });
  } else {
    console.log('lib/userCache.ts [6608] profile HIT/SET', { email, ver, key });
  }
  return hit;
}

/**
 * cacheReadUserUsage
 * @description
 *   Versioned, read-through cache for a user’s usage snapshot. The caller provides a loader that
 *   reads or creates/migrates the usage document. Time complexity is O(1) for Redis operations.
 */
export async function cacheReadUserUsage(
  email: string,
  loader: () => Promise<UserUsage | null | undefined>
): Promise<UserUsage | null> {
  const ver = await getUserVersion(email);
  const key = userUsageKey(ver, email);

  const wrapped = async () => {
    const u = await loader();
    if (!u) {
      console.log('lib/userCache.ts [6611] usage loader→NEG', { email, ver });
      return null;
    }
    console.log('lib/userCache.ts [6612] usage loader→OK', { email, ver });
    return u;
  };

  const hit = await cacheAside<UserUsage>(
    key,
    CACHE_TTL.USER_USAGE,
    wrapped,
    { negativeTtlSec: NEGATIVE_TTL.DEFAULT }
  );

  if (hit == null) {
    console.log('lib/userCache.ts [6613] usage NEG hit', { email, ver, key });
  } else {
    console.log('lib/userCache.ts [6614] usage HIT/SET', { email, ver, key });
  }
  return hit;
}

/**
 * readValidationResult
 * @description
 *   Reads a short-lived, composite validation result from Redis for (service,email,ver). This is an
 *   optional micro-cache that helps when multiple requests ask the same question within seconds.
 *   Time complexity is O(1).
 */
export async function readValidationResult(
  service: string,
  email: string,
  ver: number
): Promise<ValidationResult | null> {
  const client = getRedis();
  const key = validationResultKey(ver, service, email);
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ValidationResult;
    console.log('lib/userCache.ts [6621] validation HIT', { service, email, ver });
    return parsed;
  } catch (e) {
    console.warn('lib/userCache.ts [6622] validation read fail-open', { service, email, err: (e as Error)?.message });
    return null;
  }
}

/**
 * writeValidationResult
 * @description
 *   Stores a composite validation result for a brief period keyed by (service,email,ver).
 *   UPDATED (Phase 2): If the result is a **denial** and a `retryAfter` (seconds) is provided,
 *   we cap the TTL by that value so the cached denial cannot outlive the real wait window.
 *   "Allow" results continue to use the base TTL for performance.
 *
 * Algorithm (serverless-safe):
 *   1) Determine base TTL from policy (CACHE_TTL.VALIDATION_RESULT).
 *   2) If value.allowed === false and a finite value.retryAfter is present:
 *      2.1) ttl = min(baseTTL, retryAfter)
 *   3) If denial but retryAfter is missing/invalid:
 *      3.1) ttl = min(baseTTL, SHORT_DENIAL_TTL)  // defensive fallback (keeps denials short)
 *   4) If allowed:
 *      4.1) ttl = baseTTL
 *   5) Write with SETEX and log the effective ttl.
 */
export async function writeValidationResult( // update - 2003
  service: string,
  email: string,
  ver: number,
  value: ValidationResult
): Promise<void> {
  const client = getRedis();
  const key = validationResultKey(ver, service, email);

  try {
    // (1) Load base policy TTL (sec)
    const baseTtl = CACHE_TTL.VALIDATION_RESULT;

    // (2) Define a short fallback TTL (sec) for denials when retryAfter is absent/invalid.
    //     Keep tiny to avoid masking re-eligibility: 60–120s works well.
    const SHORT_DENIAL_TTL = 120;

    // (3) Compute effective TTL
    let ttl: number = baseTtl;

    if (value && value.allowed === false) {
      // (3.1) Prefer caller-provided retryAfter when valid; otherwise use short denial TTL.
      const ra = Number(value.retryAfter);
      if (Number.isFinite(ra) && ra > 0) {
        // Bound by base to avoid excessively long pins and add a floor of 1 second.
        ttl = Math.max(1, Math.min(baseTtl, Math.floor(ra)));
      } else {
        ttl = Math.max(1, Math.min(baseTtl, SHORT_DENIAL_TTL));
      }
    }

    // (4) Persist to Redis
    await client.setex(key, ttl, JSON.stringify(value));
    console.log('lib/userCache.ts [6623] validation SET (Phase 2)', { service, email, ver, ttl, allowed: value?.allowed });
  } catch (e) {
    console.warn('lib/userCache.ts [6624] validation write failed (non-fatal)', {
      service, email, err: (e as Error)?.message
    });
  }
}
