// app/privacy-terms/page.tsx

import React from 'react';
import SiteHeader from '@/components/SiteHeader';
import PrivacyPolicyContent from './privacy-terms';
// update - 1: Import SiteFooter
import SiteFooter from '@/components/SiteFooter';

/**
 * @file privacy-terms/page.tsx
 * @description Next.js App Router entry point for the Privacy Policy page.
 * * Responsibilities:
 * 1. Define the page layout structure.
 * 2. Render the shared SiteHeader (Navigation) and SiteFooter.
 * 3. Render the PrivacyPolicyContent (Static Text).
 */

export default function PrivacyPolicyPage() {
  return (
    <main>
      {/* 1. Global Navigation */}
      <SiteHeader />

      {/* 2. Main Content Area */}
      <PrivacyPolicyContent />

      {/* update - 2: Add Footer */}
      <SiteFooter />
    </main>
  );
}