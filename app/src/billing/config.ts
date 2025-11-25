/**
 * @file app/src/billing/config.ts
 * @description
 * Simplified configuration access for Stripe.
 *
 * Philosophy: "Permissive Read, Strict Validation".
 * - Getters return process.env values directly.
 * - If a value is missing (e.g. during Docker build), it returns an empty string.
 * - This prevents build crashes.
 * - Validation is performed by the consumer (Adapter/API) at runtime.
 */

import 'server-only';

// 1. Simple accessor. No throwing.
function env(key: string): string {
  return process.env[key] || '';
}

// 2. Export Getters
export const getStripeSecretKey = () => env('STRIPE_SECRET_KEY');
export const getStripePublishableKey = () => env('STRIPE_PUBLISHABLE_KEY');
export const getStripeWebhookSecret = () => env('STRIPE_WEBHOOK_SECRET');

export const getPriceScholarMonthly = () => env('PRICE_SCHOLAR_MONTHLY');
export const getPriceScholarAnnual = () => env('PRICE_SCHOLAR_ANNUAL');
export const getPriceEducatorMonthly = () => env('PRICE_EDUCATOR_MONTHLY');
export const getPriceEducatorAnnual = () => env('PRICE_EDUCATOR_ANNUAL');

export const getAppBaseUrl = () => env('APP_BASE_URL');

// 3. URL Helpers
export function successUrl(): string {
  return `${getAppBaseUrl()}/billing/success`;
}
export function cancelUrl(): string {
  return `${getAppBaseUrl()}/billing/canceled`;
}
export function portalReturnUrl(): string {
  return `${getAppBaseUrl()}/billing/portal-return`;
}

/**
 * Helper to populate the Known Price IDs set dynamically.
 */
export function getKnownPriceIds(): Set<string> {
  return new Set([
    getPriceScholarMonthly(),
    getPriceScholarAnnual(),
    getPriceEducatorMonthly(),
    getPriceEducatorAnnual(),
  ].filter(id => id !== '')); // Filter out empty strings from build time
}