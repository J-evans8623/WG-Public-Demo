/**
 * @file app/src/billing/stripeAdapter.ts
 * @description
 *   A thin, stateless adapter over the official Stripe Node SDK that encapsulates all direct calls
 *   to the Stripe API. The core goal is to isolate Stripe-specific concerns (SDK usage, idempotency
 *   headers, API versions, and webhook signature verification) from the rest of the WiseGraph
 *   codebase. The adapter exposes a small set of high-level primitives—getting/creating a Customer,
 *   creating a Checkout Session for subscriptions, creating a Billing Portal Session, retrieving a
 *   normalized Subscription snapshot, and verifying webhooks—so other modules interact only with
 *   application semantics. All functions are O(1) network operations (latency bound) with no hidden
 *   global state or caching. This file intentionally keeps error surfaces small and returns normalized
 *   DTOs for predictable behavior across environments and API version changes. Additionally, this
 *   module provides defensive guards where Stripe’s OpenAPI type generation may omit certain legacy
 *   or region/feature-gated fields (e.g., `current_period_end`), ensuring type safety without `any`.
 */

import Stripe from 'stripe';
import {
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
} from './config';
import {
  CheckoutParams,
  CheckoutResult,
  PortalParams,
  PortalResult,
  SubscriptionSnapshot,
} from './types';

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  // Using Stripe's recommended default; pin a version if desired.
  apiVersion: '2025-10-29.clover',
  appInfo: {
    name: 'WiseGraph Billing',
    version: '1.0.0',
  },
});

/**
 * getOrCreateCustomer
 * @purpose
 *   Return a Stripe Customer ID for a given user. If none exists, create one and tag with app metadata.
 *   This keeps WiseGraph PCI-minimal and lets Stripe handle billing profiles. O(1) remote call.
 */
export async function getOrCreateCustomer(email: string, appUserId: string): Promise<string> {
  // 1) Try to find existing by email (best-effort; can be multiple if migrated).
  const search = await stripe.customers.search({
    query: `email:'${email.replace(/'/g, "\\'")}'`,
    limit: 1,
  });

  if (search.data.length > 0) {
    return search.data[0].id;
  }

  // 2) Create a new customer if none found.
  const created = await stripe.customers.create({
    email,
    metadata: { appUserId },
  });

  return created.id;
}

/**
 * createCheckoutSession
 * @purpose
 *   Create a Stripe Checkout Session in subscription mode for the given price. Attaches idempotency
 *   keys to tolerate client retries without duplicate sessions. Returns only url and sessionId to
 *   avoid leaking sensitive details. O(1) remote call.
 */
export async function createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult> {
  const { customerId, priceId, successUrl, cancelUrl, email, idempotencyKey } = params;

  const base: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    customer_update: { address: 'auto', name: 'auto' },
  };

  // ✅ Mutually exclusive identity fields
  const identity: Partial<Stripe.Checkout.SessionCreateParams> =
    customerId
      ? { customer: customerId }                          // prefer existing customer
      : (email ? { customer_email: email } : {});         // fallback: email only

  const session = await stripe.checkout.sessions.create(
    { ...base, ...identity },
    idempotencyKey ? { idempotencyKey } : undefined
  );

  if (!session.url || !session.id) {
    throw new Error('Stripe returned an invalid Checkout Session (missing url or id).');
  }
  return { url: session.url, sessionId: session.id };
}

/**
 * createBillingPortalSession
 * @purpose
 *   Create a self-serve Billing Portal session so users can manage payment methods and cancel plans.
 *   Keeps WiseGraph out of PCI flows. O(1) remote call.
 */
export async function createBillingPortalSession(params: PortalParams): Promise<PortalResult> {
  const { customerId, returnUrl } = params;
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return { url: portal.url };
}

/**
 * getCurrentPeriodEnd
 * @purpose
 *   Safely read the current period end timestamp from a Subscription object even when Stripe’s
 *   generated TypeScript types don’t declare `current_period_end`. Some API versions or generated
 *   specs omit this field from `Subscription`, while it can still be present at runtime or located
 *   under the first subscription item in certain responses. This helper avoids `any` by using a
 *   type intersection for optional fields and gracefully falls back to `null` when missing.
 *   Time complexity is O(1).
 */
function getCurrentPeriodEnd(
  sub: Stripe.Subscription
): number | null { /* update - 1 */
  // 1) Attempt to read from subscription (runtime field on many API versions).
  const subWithPeriod = sub as Stripe.Subscription & { current_period_end?: number };
  if (typeof subWithPeriod.current_period_end === 'number') {
    return subWithPeriod.current_period_end;
  }

  // 2) Fallback: some payloads include period boundaries on the first subscription item.
  const firstItem = sub.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  if (firstItem && typeof firstItem.current_period_end === 'number') {
    return firstItem.current_period_end;
  }

  // 3) If not available, return null (caller can choose to compute/omit).
  return null;
}

/**
 * retrieveSubscription
 * @purpose
 *   Normalize a Subscription into a small snapshot used by our webhook handler and any diagnostics.
 *   O(1) remote call.
 */
export async function retrieveSubscription(subId: string): Promise<SubscriptionSnapshot> {
  const sub = await stripe.subscriptions.retrieve(subId);
  const item = sub.items?.data?.[0];
  const priceId = item?.price?.id ?? null;
  const productId = (item?.price?.product as string) ?? null;

  const currentPeriodEnd = getCurrentPeriodEnd(sub); /* update - 2 */

  return {
    status: sub.status as SubscriptionSnapshot['status'],
    priceId,
    productId,
    currentPeriodEnd,                                   /* update - 2 */
    cancelAtPeriodEnd: !!(sub as Stripe.Subscription & { cancel_at_period_end?: boolean }).cancel_at_period_end,
  };
}

/**
 * verifyWebhook
 * @purpose
 *   Verify Stripe webhook signatures using the raw request body and the configured signing secret.
 *   Returns a typed Stripe.Event for downstream switching. O(1).
 */
export function verifyWebhook(rawBody: Buffer | string, sigHeader: string | null): Stripe.Event {
  if (!sigHeader) {
    throw new Error('Missing Stripe-Signature header.');
  }
  return stripe.webhooks.constructEvent(rawBody, sigHeader, STRIPE_WEBHOOK_SECRET);
}
