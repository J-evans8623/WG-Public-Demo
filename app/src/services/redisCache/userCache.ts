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
 *     - Firestore remains the source of truth; Redis is an accelerator that must never block reads.
 *     - Fail-open posture: if Redis is down or misbehaving, we still call loaders and return fresh
 *       data so that user-facing endpoints (including authenticated Next.js handlers that rely on
 *       `authenticateRequest.ts`) degrade gracefully rather than throwing 500s. Redis outages should
 *       increase latency, not break core functionality or subscription flows. All Redis operations
 *       remain O(1) with respect to algorithmic complexity; loader complexity is external and tied
 *       to Firestore or other backing services. Logging is intentionally structured and location-
 *       tagged, making it easy to understand whether a read came from cache, negative cache, or a
 *       direct loader fallback when debugging production incidents or analyzing performance trends.
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
 *   this value in cache keys to tie reads to the latest write. Time complexity is O(1) for Redis
 *   operations, and failures in this function deliberately fall back to version 0 so that version
 *   resolution is never a reason to fail user-visible endpoints or subscription gating flows.
 */
export async function getUserVersion(email: string): Promise<number> {
  const client = getRedis();
  try {
    const raw = await client.get(userVersionKey(email));
    const ver = raw ? Number(raw) : 0; // ← default 0 so first INCR moves 0→1
    return Number.isFinite(ver) && ver >= 0 ? ver : 0;
  } catch {
    return 0;
  }
}

/**
 * bumpUserVersion
 * @description
 *   Increment the per-user version counter. Call this immediately after successful Firestore writes
 *   that affect profile/usage/validation semantics. Readers will automatically shift to fresh keys.
 *   Returns the new version for observability. Time complexity is O(1). A failure here is logged
 *   but does not throw, because inability to bump the cache version must not break user flows.
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
 *   applies cache-aside with negative-cache protection for nulls. If the cache path fails (for
 *   example due to Redis connectivity issues), the function fails open by invoking the loader
 *   directly, ensuring user profile reads never return 500 purely because the cache is unhealthy.
 */
export async function cacheReadUserProfile(
  email: string,
  loader: () => Promise<UserProfile | null | undefined>
): Promise<UserProfile | null> {
  const ver = await getUserVersion(email);
  const key = userProfileKey(ver, email);

  // update - 2004
  // (1) Wrap the caller-provided loader to normalize nullish values and add logging.
  const wrapped = async (): Promise<UserProfile | null> => {
    // (1.1) Execute the authoritative loader, which may create or read a profile from Firestore.
    const p = await loader();
    // (1.2) On a nullish result, log and propagate a normalized null used for negative caching.
    if (!p) {
      console.log('lib/userCache.ts [6605] profile loader→NEG', { email, ver });
      return null;
    }
    // (1.3) On a successful profile read, log key attributes for observability.
    console.log('lib/userCache.ts [6606] profile loader→OK', {
      email,
      ver,
      tier: p.subscriptionTier,
      acct: p.accountType,
    });
    // (1.4) Return the strongly typed profile object.
    return p;
  };

  // (2) Attempt to read through cacheAside, mirroring the docCache.ts fail-open pattern.
  try {
    const hit = await cacheAside<UserProfile>(
      key,
      CACHE_TTL.USER_PROFILE,
      wrapped,
      { negativeTtlSec: NEGATIVE_TTL.DEFAULT }
    );

    // (2.1) Distinguish between a negative cache hit and a concrete profile.
    if (hit == null) {
      console.log('lib/userCache.ts [6607] profile NEG hit', { email, ver, key });
    } else {
      console.log('lib/userCache.ts [6608] profile HIT/SET', { email, ver, key });
    }

    // (2.2) Return the cached or just-loaded value to the caller.
    return hit;
  } catch (e) {
    // (3) If the cache path itself fails (Redis offline, timeouts, serialization issues), fail open.
    const msg = (e as Error)?.message ?? String(e);
    console.warn('lib/userCache.ts [6609] profile cache path failed, falling back to loader', {
      email,
      ver,
      key,
      err: msg,
    });

    // (3.1) Bypass Redis on fallback to avoid recursive failures; call the loader directly.
    const fresh = await wrapped();

    // (3.2) Return the fresh profile (or null) back to the caller without additional cache attempts.
    return fresh;
  }
}

/**
 * cacheReadUserUsage
 * @description
 *   Versioned, read-through cache for a user’s usage snapshot. The caller provides a loader that
 *   reads or creates/migrates the usage document. The function mirrors `cacheReadUserProfile` by
 *   first attempting a cache-aside read and then, on any cache-layer failure (such as Redis timeouts
 *   or network errors), falling back to invoking the loader directly. This guarantees that usage-
 *   dependent flows, including subscription checks and rate limits, continue to function even if
 *   the cache is degraded, while retaining O(1) Redis-time complexity when the cache is healthy.
 */
export async function cacheReadUserUsage(
  email: string,
  loader: () => Promise<UserUsage | null | undefined>
): Promise<UserUsage | null> {
  const ver = await getUserVersion(email);
  const key = userUsageKey(ver, email);

  // update - 2005
  // (1) Wrap the caller-provided loader to normalize nullish usage and add structured logging.
  const wrapped = async (): Promise<UserUsage | null> => {
    // (1.1) Execute the authoritative loader that reads or creates usage data in Firestore.
    const u = await loader();

    // (1.2) When usage is absent, log a negative outcome and propagate null for negative caching.
    if (!u) {
      console.log('lib/userCache.ts [6611] usage loader→NEG', { email, ver });
      return null;
    }

    // (1.3) On a successful usage read, log a concise success event.
    console.log('lib/userCache.ts [6612] usage loader→OK', { email, ver });
    return u;
  };

  // (2) Attempt to read through cacheAside, catching cache-layer failures for fail-open behavior.
  try {
    const hit = await cacheAside<UserUsage>(
      key,
      CACHE_TTL.USER_USAGE,
      wrapped,
      { negativeTtlSec: NEGATIVE_TTL.DEFAULT }
    );

    // (2.1) Log whether the result came from a negative sentinel or a concrete cached value.
    if (hit == null) {
      console.log('lib/userCache.ts [6613] usage NEG hit', { email, ver, key });
    } else {
      console.log('lib/userCache.ts [6614] usage HIT/SET', { email, ver, key });
    }

    // (2.2) Return the cached or just-loaded usage snapshot to the caller.
    return hit;
  } catch (e) {
    // (3) If the cache path throws (for example Redis outages), fall back directly to the loader.
    const msg = (e as Error)?.message ?? String(e);
    console.warn('lib/userCache.ts [6615] usage cache path failed, falling back to loader', {
      email,
      ver,
      key,
      err: msg,
    });

    // (3.1) Call the wrapped loader without touching Redis again to avoid repeated cache failures.
    const fresh = await wrapped();

    // (3.2) Return the freshly loaded usage snapshot (or null) back to the caller.
    return fresh;
  }
}

/**
 * readValidationResult
 * @description
 *   Reads a short-lived, composite validation result from Redis for (service,email,ver). This is an
 *   optional micro-cache that helps when multiple requests ask the same question within seconds.
 *   Time complexity is O(1). Any Redis or JSON errors are caught and logged, and the function returns
 *   null so the caller can recompute validation instead of failing, preserving fail-open semantics.
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
      service,
      email,
      err: (e as Error)?.message,
    });
  }
}
