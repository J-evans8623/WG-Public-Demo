// app/terms-and-conditions/page.tsx

import React from 'react';
import SiteHeader from '@/components/SiteHeader';
import TermsAndConditionsContent from './terms-and-conditions';
// update - 1: Import SiteFooter
import SiteFooter from '@/components/SiteFooter';

/**
 * @file terms-and-conditions/page.tsx
 * @description Next.js App Router entry point for the Terms of Service page.
 * * Responsibilities:
 * 1. Define the page layout structure using the shared SiteHeader and SiteFooter.
 * 2. Render the semantic TermsAndConditionsContent component.
 */

export default function TermsAndConditionsPage() {
  return (
    <main>
      {/* 1. Global Navigation */}
      <SiteHeader />

      {/* 2. Main Content Area */}
      <TermsAndConditionsContent />

      {/* update - 2: Add Footer to complete the layout */}
      <SiteFooter />
    </main>
  );
}