/**
 * @file app\(marketing)\(landing-pages)\educators\page.tsx
 * @description
 * Route entry point for /educators.
 *
 * Responsibilities:
 *  - Temporary server-side redirect to /features until the dedicated
 *    educator landing page is designed and built
 *  - Once the educator page is ready, replace the redirect() call with the
 *    same page mounting pattern used in students/page.tsx and learners/page.tsx,
 *    and update AUDIENCE_CONFIG in marketing.config.ts to point to '/educators'
 *
 * ── When this page is ready to build ─────────────────────────────────────────
 *  1. Create EducatorLandingPage.tsx in this directory
 *  2. Replace the redirect below with:
 *       <EducatorLandingPage audience="educators" />
 *  3. In marketing.config.ts update educators.route from '/features' → '/educators'
 */

import { redirect } from 'next/navigation';

export default function EducatorsPage() {
  // Educator-specific landing page not yet built.
  // Sending educators to the Features page as an interim destination.
  redirect('/features');
}