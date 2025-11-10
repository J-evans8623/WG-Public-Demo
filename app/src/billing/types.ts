/**
 * @file app/src/billing/types.ts
 * @description
 *   Strongly-typed DTOs and enums for the billing subsystem. This file decouples Stripe’s raw
 *   response shapes from WiseGraph’s internal semantics so the rest of the application can rely
 *   on stable, minimal data contracts. By defining normalized types for Checkout creation, Portal
 *   sessions, Subscription snapshots, and minimal event payloads, we reduce scatter of Stripe SDK
 *   shapes across the codebase and make unit testing easier. When Stripe adds fields or changes
 *   API versions, only the adapter needs to be updated, while the rest of the app remains insulated.
 *   These types are vendor-agnostic enough that a different billing provider could be introduced
 *   behind the same interface in the future with limited surface change.
 *
 *   This file also defines the Minimal Billing Snapshot that we persist on the user profile, which
 *   records: status, productId, priceId, interval, currentPeriodEnd, cancelAtPeriodEnd, lastEventAt.
 *   The snapshot is written by Stripe webhooks exclusively, keeping Stripe as the source of truth.
 */

export type AppTier = 'freemium' | 'premium';
export type AppRole = 'scholar' | 'educator';

export interface CheckoutParams {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  email?: string;
  idempotencyKey?: string;
}

export interface CheckoutResult {
  url: string;
  sessionId: string;
}

export interface PortalParams {
  customerId: string;
  returnUrl: string;
}

export interface PortalResult {
  url: string;
}

export interface SubscriptionSnapshot {
  status:
    | 'incomplete'
    | 'incomplete_expired'
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'paused';
  priceId: string | null;
  productId: string | null;
  currentPeriodEnd: number | null; // epoch seconds
  cancelAtPeriodEnd: boolean;
}

/**
 * BillingSnapshot
 * @purpose
 *   Canonical, minimal billing details persisted on the user profile. It captures exactly what
 *   the UI needs to answer “what plan is active?” and “when does it renew?” without extra Stripe
 *   lookups. It is written exclusively by webhooks so we avoid client-influenced drift. Timestamps
 *   use epoch seconds for Stripe-sourced values and epoch milliseconds for local event stamping to
 *   preserve precision. Unknown/legacy plans store interval as null to keep reads defensive.
 */
export interface BillingSnapshot {
  status:
    | 'incomplete'
    | 'incomplete_expired'
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'unpaid'
    | 'paused';
  productId: string | null;
  priceId: string | null;
  interval: 'month' | 'year' | null;
  currentPeriodEnd: number | null;   // epoch seconds from Stripe
  cancelAtPeriodEnd: boolean;
  lastEventAt: number | null;        // epoch milliseconds (Date.now()) for our audit
}



/**
 * SubscriptionPhase
 * @description
 *   High-level, UI-friendly classification of a user’s subscription state derived from raw billing
 *   data and profile tier. UNSUBSCRIBED covers freemium users and any terminated Stripe status,
 *   ACTIVE covers ongoing billing cycles, and CANCEL_AT_PERIOD_END represents users who still have
 *   premium access but have chosen not to renew. This abstraction lets components reason about
 *   display states and CTAs without encoding Stripe-specific status values directly in the UI.
 */
export type SubscriptionPhase = 'UNSUBSCRIBED' | 'ACTIVE' | 'CANCEL_AT_PERIOD_END';

/* update - 3 */
/**
 * SubscriptionUiSnapshot
 * @description
 *   Minimal, presentation-ready view of a user’s subscription. It captures the derived phase
 *   (UNSUBSCRIBED, ACTIVE, or CANCEL_AT_PERIOD_END), the effective tier and role to render,
 *   a human-friendly planLabel (for example “Scholar • Premium • Monthly”), and a renewalDate
 *   with the associated copy (“Renews on” vs “Ends on”) when applicable. All fields are computed
 *   from accountType, subscriptionTier, and BillingSnapshot in O(1), so no extra Stripe calls or
 *   complex logic are needed in React components or server-rendered pages.
 */
export interface SubscriptionUiSnapshot {
  phase: SubscriptionPhase;
  effectiveTier: AppTier;
  effectiveRole: AppRole;
  planLabel: string;
  renewalDate: Date | null;
  renewalCopy: 'Renews on' | 'Ends on' | null;
}

/* update - 4 */
/**
 * capitalizePlanPart
 * @description
 *   Small helper that transforms a lower-case identifier such as “scholar” or “educator” into a
 *   title-cased label suitable for UI copy. It defends against empty strings and unexpected values
 *   by returning an empty string when input is falsy. Time complexity is O(N) in the length of the
 *   label, which is effectively O(1) for these short, fixed identifiers.
 */
function capitalizePlanPart(part: string): string {
  if (!part) return '';
  if (part.length === 1) return part.toUpperCase();
  return part.charAt(0).toUpperCase() + part.slice(1);
}

/* update - 5 */
/**
 * deriveSubscriptionUiSnapshot
 * @description
 *   Derives a normalized, UI-friendly snapshot of a user’s subscription state using only the account
 *   type, app-level subscription tier, and the persisted BillingSnapshot. This function converts raw
 *   Stripe status values into one of three phases (UNSUBSCRIBED, ACTIVE, CANCEL_AT_PERIOD_END) and
 *   computes a human-readable plan label such as “Scholar • Premium • Monthly”, along with a renewal
 *   date and copy (“Renews on” vs “Ends on”) when Stripe provides a currentPeriodEnd. It intentionally
 *   performs only O(1) work and uses no environment variables or Stripe SDK calls, making it safe for
 *   both server and client environments without leaking billing secrets into the browser bundle.
 */
export function deriveSubscriptionUiSnapshot(params: {
  accountType: AppRole;
  subscriptionTier: AppTier;
  billing: BillingSnapshot | null | undefined;
}): SubscriptionUiSnapshot {
  const { accountType, subscriptionTier, billing } = params;

  // Step 1 — Normalize raw status into a phase. O(1).
  const status = billing?.status ?? null;

  const isTerminated =
    status === 'canceled' ||
    status === 'unpaid' ||
    status === 'incomplete_expired';

  const isStripeActiveLike =
    status === 'active' ||
    status === 'trialing' ||
    status === 'past_due';

  let phase: SubscriptionPhase;

  if (!billing || subscriptionTier === 'freemium' || isTerminated) {
    phase = 'UNSUBSCRIBED';
  } else if (billing.cancelAtPeriodEnd) {
    phase = 'CANCEL_AT_PERIOD_END';
  } else if (isStripeActiveLike) {
    phase = 'ACTIVE';
  } else {
    // Defensive fallback: treat unknown/mismatched statuses as unsubscribed.
    phase = 'UNSUBSCRIBED';
  }

  // Step 2 — Derive effective tier and role. O(1).
  const isPremiumEffective = phase === 'ACTIVE' || phase === 'CANCEL_AT_PERIOD_END';
  const effectiveTier: AppTier = isPremiumEffective ? 'premium' : 'freemium';
  const effectiveRole: AppRole = accountType;

  // Step 3 — Build human-friendly plan label. O(1).
  const roleLabel = capitalizePlanPart(effectiveRole);
  const tierLabel = isPremiumEffective ? 'Premium' : 'Freemium';

  let intervalLabel: string | null = null;
  if (isPremiumEffective && billing?.interval) {
    intervalLabel = billing.interval === 'month' ? 'Monthly' : 'Annual';
  }

  const baseLabel = `${roleLabel} • ${tierLabel}`;
  const planLabel = intervalLabel ? `${baseLabel} • ${intervalLabel}` : baseLabel;

  // Step 4 — Convert epoch seconds into Date for renewal or end-of-access. O(1).
  let renewalDate: Date | null = null;
  if (typeof billing?.currentPeriodEnd === 'number' && billing.currentPeriodEnd > 0) {
    renewalDate = new Date(billing.currentPeriodEnd * 1000);
  }

  let renewalCopy: 'Renews on' | 'Ends on' | null = null;
  if (phase === 'ACTIVE') {
    renewalCopy = 'Renews on';
  } else if (phase === 'CANCEL_AT_PERIOD_END') {
    renewalCopy = 'Ends on';
  }

  return {
    phase,
    effectiveTier,
    effectiveRole,
    planLabel,
    renewalDate,
    renewalCopy,
  };
}