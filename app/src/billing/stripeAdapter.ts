/**
 * @file app/src/billing/stripeAdapter.ts
 * @description
 * Stripe SDK wrapper.
 * Includes strict runtime validation: If keys are missing when this code RUNS, it throws.
 */

import Stripe from 'stripe';
import {
  getStripeSecretKey,
  getStripeWebhookSecret,
} from './config';
import {
  CheckoutParams,
  CheckoutResult,
  PortalParams,
  PortalResult,
  SubscriptionSnapshot,
} from './types';

// Singleton instance
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = getStripeSecretKey();
    // STRICT VALIDATION HERE:
    // This only runs when an API route calls getStripe(), so it won't break the build.
    if (!key) {
      throw new Error('[StripeAdapter] Missing STRIPE_SECRET_KEY. Check server configuration.');
    }

    stripeInstance = new Stripe(key, {
      apiVersion: '2025-10-29.clover' as any,
      appInfo: { name: 'WiseGraph Billing', version: '1.0.0' },
    });
  }
  return stripeInstance;
}

export async function getOrCreateCustomer(email: string, appUserId: string): Promise<string> {
  const stripe = getStripe();
  const search = await stripe.customers.search({
    query: `email:'${email.replace(/'/g, "\\'")}'`,
    limit: 1,
  });

  if (search.data.length > 0) {
    return search.data[0].id;
  }

  const created = await stripe.customers.create({
    email,
    metadata: { appUserId },
  });

  return created.id;
}

export async function createCheckoutSession(params: CheckoutParams): Promise<CheckoutResult> {
  const stripe = getStripe();
  const { customerId, priceId, successUrl, cancelUrl, email, idempotencyKey } = params;

  // Basic validation for priceId
  if (!priceId) throw new Error('createCheckoutSession: missing priceId');

  const base: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    customer_update: { address: 'auto', name: 'auto' },
  };

  const identity: Partial<Stripe.Checkout.SessionCreateParams> =
    customerId
      ? { customer: customerId }
      : (email ? { customer_email: email } : {});

  const session = await stripe.checkout.sessions.create(
    { ...base, ...identity },
    idempotencyKey ? { idempotencyKey } : undefined
  );

  if (!session.url || !session.id) {
    throw new Error('Stripe returned an invalid Checkout Session.');
  }
  return { url: session.url, sessionId: session.id };
}

export async function createBillingPortalSession(params: PortalParams): Promise<PortalResult> {
  const stripe = getStripe();
  const { customerId, returnUrl } = params;
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return { url: portal.url };
}

function getCurrentPeriodEnd(sub: Stripe.Subscription): number | null {
  const subWithPeriod = sub as Stripe.Subscription & { current_period_end?: number };
  if (typeof subWithPeriod.current_period_end === 'number') {
    return subWithPeriod.current_period_end;
  }
  const firstItem = sub.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  if (firstItem && typeof firstItem.current_period_end === 'number') {
    return firstItem.current_period_end;
  }
  return null;
}

export async function retrieveSubscription(subId: string): Promise<SubscriptionSnapshot> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subId);
  const item = sub.items?.data?.[0];
  const priceId = item?.price?.id ?? null;
  const productId = (item?.price?.product as string) ?? null;

  const currentPeriodEnd = getCurrentPeriodEnd(sub);

  return {
    status: sub.status as SubscriptionSnapshot['status'],
    priceId,
    productId,
    currentPeriodEnd,
    cancelAtPeriodEnd: !!(sub as Stripe.Subscription & { cancel_at_period_end?: boolean }).cancel_at_period_end,
  };
}

export function verifyWebhook(rawBody: Buffer | string, sigHeader: string | null): Stripe.Event {
  const stripe = getStripe();
  const secret = getStripeWebhookSecret();
  if (!secret) {
    throw new Error('[StripeAdapter] Missing STRIPE_WEBHOOK_SECRET.');
  }
  if (!sigHeader) {
    throw new Error('Missing Stripe-Signature header.');
  }
  return stripe.webhooks.constructEvent(rawBody, sigHeader, secret);
}