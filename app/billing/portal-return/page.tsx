/**
 * @file app/billing/portal-return/page.tsx
 * Server component shell for the billing portal return page.
 * Exposes metadata and renders the client logic.
 */

import type { Metadata } from 'next';
import PortalReturnClient from './PortalReturnClient';

export const metadata: Metadata = {
  title: 'WiseGraph — Billing updated',
  description: 'Your billing changes were saved. We’re syncing your account.',
};

export default function PortalReturnPage() {
  return <PortalReturnClient />;
}
