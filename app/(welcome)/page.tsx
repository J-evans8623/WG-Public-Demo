// app/(marketing)/welcome/page.tsx

/**
 * @file app/(marketing)/welcome/page.tsx
 * @description Next.js route entry for the WiseGraph marketing welcome page.
 * Delegates rendering to the client-side <WelcomeLandingPage /> shell
 * and now includes the global SiteFooter.
 */

import type { Metadata } from 'next';
import React from 'react';
import WelcomeLandingPage from './WelcomeLandingPage';
// update - 1: Import the global footer component
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: 'WiseGraph — Unlock Your True Learning Potential',
  description:
    'Turn chapters into clear concept maps, auto-build a study schedule, and stay out of cramming mode with WiseGraph.',
};

/**
 * Default export for /welcome.
 * Renders the Landing Page client shell followed by the SiteFooter.
 */
export default function Page(): JSX.Element {
  return (
    // update - 2: Wrap in fragment to render Footer below the landing content
    <>
      <SiteHeader />
      <WelcomeLandingPage />
      <SiteFooter />
    </>
  );
}