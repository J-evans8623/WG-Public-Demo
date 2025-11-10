/**
 * @file pages/api/stripe/portal.ts
 * @description
 *   Authenticated endpoint to create a Stripe Billing Portal Session so users can manage billing:
 *   update payment methods, review invoices, cancel subscriptions, etc. The route validates the
 *   session via `authenticateRequest`, ensures a Stripe Customer exists (creates one if needed),
 *   and returns the Portal URL for client-side redirection. This keeps billing management entirely
 *   within Stripe’s PCI-compliant UI while WiseGraph merely brokers access.
 *
 * Request (POST JSON): {}
 * Response (200 JSON): { url: string }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { createBillingPortalSession, getOrCreateCustomer } from '@/app/src/billing/stripeAdapter';
import { portalReturnUrl } from '@/app/src/billing/config';
import { UserService } from '@/app/src/services/userService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Step 1 — Method guard.
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Step 2 — Authenticate user.
  const session = await authenticateRequest(req, res);
  if (!session) {
    return; // 401 already sent by authenticateRequest
  }

  const userProfile = await UserService.getUserProfile(session.user.email);

  // Step 3 — Ensure Customer exists for this user.
  const email = userProfile.email;
  const appUserId = userProfile.userId;
  const customerId = userProfile.stripeCustomerId
    ? userProfile.stripeCustomerId
    : await getOrCreateCustomer(email, appUserId);

  // Step 4 — Create Portal Session.
  const portal = await createBillingPortalSession({
    customerId,
    returnUrl: portalReturnUrl(),
  });

  // Step 5 — Return URL.
  return res.status(200).json({ url: portal.url });
}
