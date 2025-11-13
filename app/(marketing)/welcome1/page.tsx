/**
 * @file app/(marketing)/welcome/page.tsx
 * @description (new update - landing layout refactor)
 *   Next.js route entry for the WiseGraph marketing welcome page.
 *   Delegates rendering to the client-side <WelcomeLandingPage /> shell
 *   and defines static metadata for the route.
 */

import type { Metadata } from 'next';
import React from 'react';
import WelcomeLandingPage from './WelcomeLandingPage';

/**
 * Route metadata for the marketing welcome page.
 * (new update - landing layout refactor)
 */
export const metadata: Metadata = {
  title: 'WiseGraph — Unlock Your True Learning Potential',
  description:
    'Turn chapters into clear concept maps, auto-build a study schedule, and stay out of cramming mode with WiseGraph.',
};

/**
 * Default export for /welcome.
 * (new update - landing layout refactor)
 *
 * This component stays server-side and simply renders the
 * client-side landing shell, keeping things compatible with
 * the Next.js App Router and making it easy to add more
 * client-only behavior inside the shell later.
 */
export default function Page(): JSX.Element {
  return <WelcomeLandingPage />;
}
