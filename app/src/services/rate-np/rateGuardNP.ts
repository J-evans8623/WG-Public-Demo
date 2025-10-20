// app/src/rate-np/rateGuardNP.ts

/**
 * @file app/src/rate-np/rateGuardNP.ts
 * @description
 *   Production-grade, multi-window Redis-only gate runner for non-premium endpoints. For each configured
 *   fixed window (e.g., 5m/15m/30m/60m), we atomically attempt a window increment using the existing
 *   Redis helper (`fixedWindowTry`) and collect any violations. If one or more windows are exceeded,
 *   we deny and compute the **composite Retry-After** as the **maximum** TTL among violated windows,
 *   because the caller cannot be allowed until **all** violated windows have reset. This corrects the
 *   common mistake of using the minimum TTL, which would suggest an earlier retry that would still be
 *   blocked by a longer window. This module does not touch Firestore and will fail-open on Redis errors
 *   to preserve availability for non-premium features.
 *
 *   Responsibilities:
 *   1) Iterate configured windows (N ≤ 4) and check allowance via Redis.
 *   2) Aggregate violations and compute the correct Retry-After (max of TTLs).
 *   3) Return a GateDecision with allowed=false and retryAfterSec>0 when blocked.
 *   4) Fail-open on Redis exceptions (allowed=true) with a clear diagnostic log.
 *
 *   Performance & Complexity:
 *   - Time: O(N) where N is the number of windows (≤ 4).
 *   - Space: O(1).
 *   - Network: one Redis operation per window checked.
 *
 *   Observability:
 *   - Purposeful console logs with file tag and a unique 4-digit code at key checkpoints:
 *     • begin (4301), blocked (4302), allowed (4303), redis error (4304).
 */

import type { GateDecision, RatePolicy } from './types';
import { fixedWindowTry } from '@/app/src/services/redisCache/rateGate';

/**
 * runGate
 * @purpose
 *   Execute all fixed windows for a scope/subject and decide allow/deny. If any window is exceeded,
 *   compute the **maximum** retryAfter across those windows so the client waits until all relevant
 *   limits have reset. This avoids misleading short retry intervals that would still be blocked.
 * @steps
 *   1) Start and log scope/subject.
 *   2) For each window:
 *      2.1) Call fixedWindowTry(...)
 *      2.2) If violated, capture window TTL as a positive integer (≥1).
 *   3) If we have any violations, deny with retryAfterSec = max(violations).
 *   4) If none, allow with retryAfterSec = 0.
 *   5) If Redis throws, log and fail-open (allowed).
 */
export async function runGate(policy: RatePolicy, subject: string): Promise<GateDecision> {
  console.log('[rateGuardNP.ts][4301] runGate begin', { scope: policy.scope, subject });

  try {
    // update - 1: track the **maximum** time we need to wait across violated windows
    let maxRetryAfter = 0;

    for (const w of policy.windows) {
      // Step 2.1: attempt the window increment/check
      const res = await fixedWindowTry(`np:${policy.scope}:${w.windowSeconds}`, subject, w.maxRequests, w.windowSeconds);

      // Step 2.2: capture violation TTL
      if (!res.allowed) {
        // The helper returns seconds (integer). Guard with ≥1 in case of boundary races.
        const ra = Math.max(1, Math.floor(res.retryAfterSec || 1));
        if (ra > maxRetryAfter) {
          maxRetryAfter = ra;
        }
      }
    }

    // Step 3: decide
    if (maxRetryAfter > 0) {
      console.log('[rateGuardNP.ts][4302] runGate blocked', { scope: policy.scope, retryAfterSec: maxRetryAfter }); // update - 2
      return { allowed: false, retryAfterSec: maxRetryAfter, reason: 'LIMIT_EXCEEDED' };
    }

    // Step 4: allowed
    console.log('[rateGuardNP.ts][4303] runGate allowed', { scope: policy.scope });
    return { allowed: true, retryAfterSec: 0 };
  } catch (e: any) {
    // Step 5: fail-open on Redis errors (non-premium availability > strictness)
    console.warn('[rateGuardNP.ts][4304] runGate redis error fail-open', { scope: policy.scope, err: e?.message });
    return { allowed: true, retryAfterSec: 0, reason: 'REDIS_ERROR' };
  }
}
