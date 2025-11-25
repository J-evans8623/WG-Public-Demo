/**
 * @file pages/api/stripe/checkout.ts
 * @description
 *   Authenticated endpoint to create a Stripe Checkout Session for subscription purchases.
 *   The route validates the user session via `authenticateRequest`, obtains or creates a
 *   Stripe Customer, and creates a Checkout Session for the provided `priceId`. It returns
 *   a JSON payload containing the hosted Checkout URL so the client can redirect.
 *
 *   This implementation also includes a small duplicate-plan guard that relies solely on
 *   the `userProfile` present on the enhanced session. It does **not** perform any extra
 *   Firestore reads. If the user is already on a premium subscription whose `billing.priceId`
 *   matches the requested `priceId`, the handler responds with HTTP 409, preventing a
 *   duplicate subscription purchase even if the client UI is stale.
 *
 * Request (POST JSON):
 *   { priceId: string, idempotencyKey?: string }
 *
 * Response (200 JSON):
 *   { url: string, sessionId: string, returnTo: string }
 *
 * AuthZ:
 *   Requires a valid NextAuth session. Otherwise returns 401 (from authenticateRequest).
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import {getKnownPriceIds, successUrl, cancelUrl, portalReturnUrl } from '@/app/src/billing/config';
import { createCheckoutSession, getOrCreateCustomer } from '@/app/src/billing/stripeAdapter';
import { UserService } from '@/app/src/services/userService';

type Body = { priceId?: string; idempotencyKey?: string };

/**
 * handler
 * @description
 *   Main request handler for `/api/stripe/checkout`. Performs:
 *     1) Method guard.
 *     2) Authentication.
 *     3) Input validation (`priceId`).
 *     4) Duplicate-plan guard using session profile only.
 *     5) Stripe customer retrieval/creation.
 *     6) Stripe Checkout Session creation.
 *     7) JSON response with redirect URL and session ID.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Step 1 — Method guard.
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Step 2 — Authenticate using shared utility.
  const session = await authenticateRequest(req, res);
  if (!session) {
    // authenticateRequest already responded with 401 if needed.
    return;
  }
  const KNOWN_PRICE_IDS = getKnownPriceIds();
  // Step 3 — Validate input payload.
  const { priceId, idempotencyKey } = (req.body || {}) as Body;
  if (!priceId || !KNOWN_PRICE_IDS.has(priceId)) {
    return res.status(400).json({ error: 'Invalid or unknown priceId.' });
  }

  const userProfile = await UserService.getUserProfile(session.user.email);
  const email = userProfile.email;
  const appUserId = userProfile.userId;

  // Step 4 — Duplicate-plan guard using session-only data.
  //          If the user is in the premium tier and the requested priceId matches
  //          their current billing.priceId, we block the purchase with a 409.
  //          This avoids redundant Firestore reads and keeps the logic simple.
  const billing = userProfile.billing ?? null; // (new update - read billing from session)
  const currentBillingPriceId =
    billing && typeof billing.priceId === 'string' ? billing.priceId : null; 

  const isPremium = userProfile.subscriptionTier === 'premium'; 

  if (isPremium && currentBillingPriceId && currentBillingPriceId === priceId) {
    return res.status(409).json({
      // (new update - duplicate plan response)
      error:
        'You are already subscribed to this plan. To change or cancel your subscription, please use the billing portal instead.',
    });
  }

  // Step 5 — Get or create Stripe Customer.
  const customerId = userProfile.stripeCustomerId
    ? userProfile.stripeCustomerId
    : await getOrCreateCustomer(email, appUserId);

  // NOTE: Persisting stripeCustomerId is handled elsewhere (e.g., webhook confirmation).

  // Step 6 — Create Stripe Checkout Session.
  const checkout = await createCheckoutSession({
    customerId,
    priceId,
    successUrl: successUrl(),
    cancelUrl: cancelUrl(),
    email,
    idempotencyKey,
  });

  // Step 7 — Return URL and session ID.
  return res
    .status(200)
    .json({ url: checkout.url, sessionId: checkout.sessionId, returnTo: portalReturnUrl() });
}
