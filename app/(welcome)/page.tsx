/**
 * @file app/(welcome)/page.tsx
 * @description
 * Actual application root route for "/".
 *
 * Responsibilities:
 *  - Performs a server-side redirect from "/" to the configured default
 *    marketing audience landing page
 *  - Reads DEFAULT_AUDIENCE from marketing.config.ts so changing the default
 *    homepage target requires editing exactly one value in one file
 *
 * Note:
 *  - This is the real root page currently resolving localhost:3000 and
 *    wisegraph.app, so the redirect belongs here.
 *  - No UI is rendered to avoid a flash of the legacy welcome page.
 */

import { redirect } from 'next/navigation';
import { DEFAULT_AUDIENCE, AUDIENCE_ROUTES } from '@/app/marketing.config';

export default function WelcomeRootPage(): never {
  redirect(AUDIENCE_ROUTES[DEFAULT_AUDIENCE]);
}