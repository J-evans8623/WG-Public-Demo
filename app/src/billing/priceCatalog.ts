/**
 * @file app/src/billing/priceCatalog.ts
 * @description
 *   Price Catalog and helpers for WiseGraph billing. This module centralizes the mapping from Stripe
 *   Price IDs to normalized WiseGraph plan semantics, namely the role (“scholar” vs “educator”) and
 *   the billing interval (“month” vs “year”). By funneling these lookups through a single table
 *   derived from environment-backed IDs, we avoid scattering fragile string comparisons across the
 *   codebase and make it trivial to swap test/live configurations without logic changes. The helpers
 *   exported here are intentionally tiny, pure, and O(1): they perform a constant-time map lookup to
 *   return the interval and role associated with a given priceId. If a priceId is unknown (e.g., an
 *   old plan retired in Stripe), helpers return `null` to keep downstream logic defensive by default.
 *
 *   Responsibilities:
 *   1) Provide a canonical, typed “priceId → { role, interval, productTag }” mapping.
 *   2) Expose helpers to get interval and role without Stripe roundtrips.
 *   3) Keep plan semantics DRY for UI, webhooks, and diagnostics.
 */

import {
  PRICE_SCHOLAR_MONTHLY,
  PRICE_SCHOLAR_ANNUAL,
  PRICE_EDUCATOR_MONTHLY,
  PRICE_EDUCATOR_ANNUAL,
} from './config';

export type CatalogRole = 'scholar' | 'educator';
export type CatalogInterval = 'month' | 'year';

type CatalogEntry = {
  role: CatalogRole;
  interval: CatalogInterval;
  // Optional tag to denote a product family if you need it later; not persisted.
  productTag: 'scholar' | 'educator';
};

/** Step 1 — Construct the immutable mapping table. O(1) lookups. */
const TABLE: Record<string, CatalogEntry> = {
  [PRICE_SCHOLAR_MONTHLY]:   { role: 'scholar',  interval: 'month', productTag: 'scholar' },
  [PRICE_SCHOLAR_ANNUAL]:    { role: 'scholar',  interval: 'year',  productTag: 'scholar' },
  [PRICE_EDUCATOR_MONTHLY]:  { role: 'educator', interval: 'month', productTag: 'educator' },
  [PRICE_EDUCATOR_ANNUAL]:   { role: 'educator', interval: 'year',  productTag: 'educator' },
};

/**
 * getPlanInterval
 * @purpose
 *   Returns the normalized billing interval associated with a known priceId using an O(1) table
 *   lookup. If the priceId is unknown (e.g., a retired plan), returns null so callers can degrade
 *   gracefully. This avoids needing to fetch Stripe objects during webhook processing or UI logic.
 */
export function getPlanInterval(priceId: string | null | undefined): CatalogInterval | null {
  if (!priceId) return null;
  return TABLE[priceId]?.interval ?? null;
}

/**
 * getRoleFromPrice
 * @purpose
 *   Returns the normalized WiseGraph role (“scholar” or “educator”) derived from a given priceId
 *   using a constant-time map. This is helpful for displaying plan labels without coupling the UI
 *   to Stripe. Returns null if the priceId is not recognized by this environment’s mapping.
 */
export function getRoleFromPrice(priceId: string | null | undefined): CatalogRole | null {
  if (!priceId) return null;
  return TABLE[priceId]?.role ?? null;
}
