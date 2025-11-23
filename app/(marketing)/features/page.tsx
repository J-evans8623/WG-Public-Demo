// app/features/page.tsx

/**
 * @file app/features/page.tsx
 * @description Features page using the shared SiteHeader and SiteFooter components.
 */

import React from 'react';
import SiteHeader from '@/components/SiteHeader'; 
import GettingStartedContent from './features-page';
// update - 1: Import SiteFooter
import SiteFooter from '@/components/SiteFooter';

export default function FeaturesPage() {
  return (
    <div className="wg-page">
      {/* 1. Use the Shared Component */}
      <SiteHeader />

      {/* 2. Render the Main Content */}
      <main>
        <GettingStartedContent />
      </main>

      {/* update - 2: Add Footer at the bottom of the page wrapper */}
      <SiteFooter />
    </div>
  );
}