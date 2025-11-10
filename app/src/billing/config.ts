/**
 * @file app/src/billing/config.ts
 * @description
 *   Centralized configuration and environment guards for the Stripe billing subsystem. This module
 *   standardizes access to all Stripe-related environment variables, price identifiers, and URL
 *   construction for return/callback endpoints so that no other part of the application needs to
 *   reach into process.env directly. By funneling every configuration read through this file, we
 *   ensure consistent behavior across environments (local, staging, production), simplify testing,
 *   and reduce the risk of misconfiguration at deploy time. The file also validates that critical
 *   secrets (secret key, webhook secret) are present and throws descriptive errors early to surface
 *   problems immediately, rather than during live payment flows. The exported helpers produce the
 *   correct “success” and “cancel” return URLs and allow the rest of the codebase to remain clean
 *   and vendor-agnostic in terms of configuration access.
 *
 * Responsibilities:
 *   1) Validate required Stripe environment variables with explicit errors.
 *   2) Expose strongly-typed accessors for keys, signing secrets, and price IDs.
 *   3) Construct canonical success/cancel/return URLs from a single APP_BASE_URL.
 *   4) Keep the rest of the billing code free from direct env lookups.
 */

export type BillingInterval = 'monthly' | 'annual';

/** Hard validation so misconfigurations are caught at boot. O(1). */
function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`[billing/config] Missing required env var: ${name}`);
  }
  return v;
}

/** Public getters for secrets and IDs (no dynamic work => O(1)). */
export const STRIPE_SECRET_KEY = required('STRIPE_SECRET_KEY');
export const STRIPE_PUBLISHABLE_KEY = required('STRIPE_PUBLISHABLE_KEY');
export const STRIPE_WEBHOOK_SECRET = required('STRIPE_WEBHOOK_SECRET');

/**
 * These map to the specific Stripe Price IDs you’ve configured for your products.
 * Keep them in env so you can swap test/live easily without code changes.
 */
export const PRICE_SCHOLAR_MONTHLY = required('PRICE_SCHOLAR_MONTHLY');
export const PRICE_SCHOLAR_ANNUAL = required('PRICE_SCHOLAR_ANNUAL');
export const PRICE_EDUCATOR_MONTHLY = required('PRICE_EDUCATOR_MONTHLY');
export const PRICE_EDUCATOR_ANNUAL = required('PRICE_EDUCATOR_ANNUAL');

/** Base URL the app is served from, e.g., https://wisegraph.app (no trailing slash). */
export const APP_BASE_URL = required('APP_BASE_URL');

/** Canonical post-checkout URLs. */
export function successUrl(): string {
  return `${APP_BASE_URL}/billing/success`;
}
export function cancelUrl(): string {
  return `${APP_BASE_URL}/billing/canceled`;
}

/** Portal return target. */
export function portalReturnUrl(): string {
  return `${APP_BASE_URL}/billing/portal-return`;
}

/** Lightweight mapping guard to check a priceId is one of our known IDs. O(1). */
export const KNOWN_PRICE_IDS = new Set<string>([
  PRICE_SCHOLAR_MONTHLY,
  PRICE_SCHOLAR_ANNUAL,
  PRICE_EDUCATOR_MONTHLY,
  PRICE_EDUCATOR_ANNUAL,
]);
