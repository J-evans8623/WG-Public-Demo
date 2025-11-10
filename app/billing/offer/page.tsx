/**
 * @file app/(billing)/offer/page.tsx
 * @description
 *   Server component that constructs the plan list using server-only price ID config,
 *   then passes to client shell. Now shows 2 plan types (Scholar/Educator) with toggle
 *   for monthly/annual billing, matching the welcome page design.
 * 
 * @updates
 *   - Reduced to 2 plan tiles with billing toggle (matching welcome page)
 *   - Correct pricing: Scholar ($9.99/$95.99), Educator ($12.99/$124.99)
 *   - All plans redirect to checkout flow
 */

import React from 'react';
import OfferPageClient from './OfferPageClient';
import {
  PRICE_SCHOLAR_MONTHLY,
  PRICE_SCHOLAR_ANNUAL,
  PRICE_EDUCATOR_MONTHLY,
  PRICE_EDUCATOR_ANNUAL,
} from '@/app/src/billing/config'; // SERVER-ONLY import is OK here

export const metadata = {
  title: 'WiseGraph — Choose your plan',
  description: 'Select a subscription plan and proceed to secure checkout.',
};

/**
 * OfferPage Server Component
 * Provides plan configuration with server-side price IDs to client component
 */
export default function OfferPage() {
  // Plan configuration with actual price IDs from server config
  const planConfig = {
    scholar: {
      monthly: {
        price: '$9.99',
        priceId: PRICE_SCHOLAR_MONTHLY,
      },
      annual: {
        price: '$95.99',
        priceId: PRICE_SCHOLAR_ANNUAL,
      },
    },
    educator: {
      monthly: {
        price: '$12.99',
        priceId: PRICE_EDUCATOR_MONTHLY,
      },
      annual: {
        price: '$124.99',
        priceId: PRICE_EDUCATOR_ANNUAL,
      },
    },
  };

  return <OfferPageClient planConfig={planConfig} />;
}