/**
 * @file app/features/page.tsx
 * @description Features page using the shared SiteHeader component.
 */

import React from 'react';
import SiteHeader from '@/components/SiteHeader'; // Import the new component
import GettingStartedContent from './features-page';

export default function FeaturesPage() {
  return (
    <div className="wg-page">
      {/* 1. Use the Shared Component */}
      <SiteHeader />

      {/* 2. Render the Main Content */}
      <main>
        <GettingStartedContent />
      </main>
    </div>
  );
}