// app/(billing)/offer/page.tsx

/**
 * @file app/(billing)/offer/page.tsx
 * @description
 * Server component that constructs the plan list using server-only price ID config,
 * passes it to the client shell, and wraps the view with the SiteFooter.
 */

import React from 'react';
import OfferPageClient from './OfferPageClient';
// update - 1: Import SiteFooter
import SiteFooter from '@/components/SiteFooter';
import {
  getPriceScholarMonthly,
  getPriceScholarAnnual,
  getPriceEducatorMonthly,
  getPriceEducatorAnnual,
} from '@/app/src/billing/config';

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
        priceId: getPriceScholarMonthly(),
      },
      annual: {
        price: '$89.99',
        priceId: getPriceScholarAnnual(),
      },
    },
    educator: {
      monthly: {
        price: '$12.99',
        priceId: getPriceEducatorMonthly(),
      },
      annual: {
        price: '$114.99',
        priceId: getPriceEducatorAnnual(),
      },
    },
  };

  return (
    // update - 2: Wrap in fragment to include Footer
    <>
      <OfferPageClient planConfig={planConfig} />
      <SiteFooter />
    </>
  );
}