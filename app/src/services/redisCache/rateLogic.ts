/**
 * @file rateLogic.ts
 * @responsibility
 *   Pure, framework-free helpers for lesson-generation rate-limit math. These functions take plain
 *   inputs (dates, numbers, strings) and return plain outputs; there is NO I/O, no Firebase, and no Redis.
 *   The goal is to centralize the “math” so both validators and enforcers stay perfectly consistent.
 *
 *   Exported:
 *     - computeLessonLimitState(now, accountType, subscriptionTier, tracking)
 *     - toDate(v) — tolerant timestamp normalizer used internally and available for reuse
 *
 *   This module MUST remain side-effect free to avoid circular deps and ease unit testing.
 *
 * @author System
 * @date Current
 */

import type { AccountType, SubscriptionTier } from '../userService';

/** Plan limits — colocated here to keep the math self-contained. */
const PLAN_LIMITS: Record<AccountType, { hourlyLimit: number; monthlyLimit: number }> = {
  scholar: { hourlyLimit: 8, monthlyLimit: 100 },
  educator: { hourlyLimit: 15, monthlyLimit: 200 },
};

/**
 * toDate
 * @purpose
 *   Normalize Firestore Timestamps, epoch ms, ISO strings, or {seconds,nanoseconds} into a JS Date.
 *   Defensive fallbacks to `new Date()` on unknown shapes.
 */
export function toDate(v: any): Date {
  // (1) Firestore Timestamp instance (has .toDate())
  if (v?.toDate) return v.toDate();
  // (2) Epoch ms
  if (typeof v === 'number') return new Date(v);
  // (3) ISO string
  if (typeof v === 'string') return new Date(v);
  // (4) Firestore-like {seconds, nanoseconds}
  if (v && typeof v.seconds === 'number') {
    return new Date(v.seconds * 1000 + ((v.nanoseconds || 0) / 1e6));
  }
  // (5) Fallback: now
  return new Date();
}

/** Input shape for the tracking payload passed into the helper. */
export type LessonTrackingInput = {
  hourlyCount: number;
  monthlyCount: number;
  hourlyPeriodStart: any;   // TS tolerates any; normalized via toDate()
  monthlyPeriodStart: any;  // ditto
};

export type LessonLimitState = {
  hourlyLimit: number;
  monthlyLimit: number;
  hourlyCountEffective: number;
  monthlyCountEffective: number;
  hourlyRemaining: number;
  monthlyRemaining: number;
  isHourlyExceeded: boolean;
  isMonthlyExceeded: boolean;
  hourlyResetAt: Date;
  monthlyResetAt: Date;
  retryAfterSec: number; // 0 if eligible now
};

/**
 * computeLessonLimitState
 * @purpose
 *   Single source of truth for lesson-generation limit math (rolling hourly + rolling 30-day).
 *   Freemium short-circuits to zeros. Premium computes read-time rollovers and precise retryAfter.
 *
 * @steps
 *   1) Resolve plan limits from accountType; short-circuit freemium to zeros.
 *   2) Normalize period starts; derive reset points (start + window).
 *   3) Apply read-time rollover: expired windows → effective counts = 0 (no writes).
 *   4) Compute remaining, exceeded flags.
 *   5) Compute precise retryAfterSec: monthly dominates hourly if both exceeded.
 */
export function computeLessonLimitState(
  now: Date,
  accountType: AccountType,
  subscriptionTier: SubscriptionTier,
  tracking: LessonTrackingInput
): LessonLimitState {
  // (1) Freemium short-circuit
  if (subscriptionTier === 'freemium') {
    const zeroDate = new Date(now.getTime()); // value unused by callers for freemium
    return {
      hourlyLimit: 0,
      monthlyLimit: 0,
      hourlyCountEffective: 0,
      monthlyCountEffective: 0,
      hourlyRemaining: 0,
      monthlyRemaining: 0,
      isHourlyExceeded: false,
      isMonthlyExceeded: false,
      hourlyResetAt: zeroDate,
      monthlyResetAt: zeroDate,
      retryAfterSec: 0,
    };
  }

  // (2) Limits + normalized period starts → reset points
  const { hourlyLimit, monthlyLimit } = PLAN_LIMITS[accountType];
  const HOUR_MS = 60 * 60 * 1000;
  const M30_MS = 30 * 24 * 60 * 60 * 1000;

  const hStart = toDate(tracking.hourlyPeriodStart);
  const mStart = toDate(tracking.monthlyPeriodStart);
  const hReset = new Date(hStart.getTime() + HOUR_MS);
  const mReset = new Date(mStart.getTime() + M30_MS);

  // (3) Read-time rollover → effective counts
  const hourlyExpired = now >= hReset;
  const monthlyExpired = now >= mReset;
  const hEff = hourlyExpired ? 0 : Math.max(0, tracking.hourlyCount || 0);
  const mEff = monthlyExpired ? 0 : Math.max(0, tracking.monthlyCount || 0);

  // (4) Remaining + exceeded
  const hRemain = Math.max(0, hourlyLimit - hEff);
  const mRemain = Math.max(0, monthlyLimit - mEff);
  const hExceeded = hRemain <= 0;
  const mExceeded = mRemain <= 0;

  // (5) Precise retryAfter (monthly dominates)
  let retryAfterSec = 0;
  if (mExceeded) retryAfterSec = Math.max(0, Math.ceil((mReset.getTime() - now.getTime()) / 1000));
  else if (hExceeded) retryAfterSec = Math.max(0, Math.ceil((hReset.getTime() - now.getTime()) / 1000));

  return {
    hourlyLimit,
    monthlyLimit,
    hourlyCountEffective: hEff,
    monthlyCountEffective: mEff,
    hourlyRemaining: hRemain,
    monthlyRemaining: mRemain,
    isHourlyExceeded: hExceeded,
    isMonthlyExceeded: mExceeded,
    hourlyResetAt: hReset,
    monthlyResetAt: mReset,
    retryAfterSec,
  };
}
