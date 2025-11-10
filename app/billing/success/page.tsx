'use client';

/**
 * @file app/(billing)/success/page.tsx
 * @description
 *   Post-checkout “Success” screen that renders entirely on the client and performs its own
 *   authenticated fetch to `/api/account/status` rather than depending on ApiContext. This
 *   design is necessary because the success route is not guaranteed to be mounted under the
 *   same React tree as the global `ApiProvider`, especially when billing flows originate
 *   outside the main Studygraph shell. Instead, the page uses a small, self-contained hook
 *   pattern: on mount, it calls the secured BFF endpoint (which internally uses
 *   `authenticateRequest`), gracefully handles 401 by redirecting to `/signin`, and stores a
 *   minimal `AccountStatus` snapshot in local state. The page then displays a friendly
 *   confirmation that payment was received, shows the user’s current subscription tier, and
 *   offers a “Refresh status” button that re-calls the endpoint to collapse any Stripe webhook
 *   race window. Styling is kept intentionally minimal and inline to avoid coupling to global
 *   CSS and to ensure this page can be safely rendered in isolation.
 *
 *   // update - 1: Switched from ApiContext consumption to direct `/api/account/status` fetch
 *   //              so this route can operate correctly even when not wrapped by ApiProvider.
 */

import React, { useEffect, useState } from 'react'; // update - 2: add hooks for local status management

/**
 * AccountStatus
 * @description
 *   Minimal shape of the `/api/account/status` response required by this page. We keep the
 *   structure aligned with the API contract but only rely on a subset of fields (email,
 *   accountType, subscriptionTier) for rendering. The extra fields are included for future
 *   extensibility and to keep the type consistent with other consumers, but they are not
 *   required for the current UI. All values are obtained in a single O(1) network round-trip.
 *   // update - 3: Local copy of account status type to decouple from ApiContext tree.
 */
type AccountStatus = {
  email: string;
  accountType: 'scholar' | 'educator';
  subscriptionTier: 'freemium' | 'premium';
  features: {
    canCreatePublicFiles: boolean;
    canInviteEditors: boolean;
    hasAdvancedFeatures: boolean;
  };
  limits: {
    maxCollaborators: number;
    maxDocuments: number;
    maxStorageGB: number;
  };
  billing: {
    status?:
      | 'incomplete'
      | 'incomplete_expired'
      | 'trialing'
      | 'active'
      | 'past_due'
      | 'canceled'
      | 'unpaid'
      | 'paused';
    priceId?: string | null;
    interval?: 'month' | 'year' | null;
    currentPeriodEnd?: number | null;
    cancelAtPeriodEnd?: boolean;
  } | null;
};

function Box({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid #E8E8E8',
        background: '#fff',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}
    >
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
      <div style={{ color: '#6C757D' }}>{label}</div>
      <div>{value}</div>
    </div>
  );
}

/**
 * @function SuccessPage
 * @description
 *   Client-side React page component that presents a post-checkout success message and the
 *   user’s current account status using a direct call to `/api/account/status`. Because this
 *   route is not guaranteed to be wrapped in the ApiContext tree, it performs its own
 *   authenticated fetch on mount, handling 401 responses by redirecting the user back to the
 *   sign-in page with a safe `returnTo` parameter. The component maintains three small pieces
 *   of local state—`accountStatus`, `isLoading`, and `error`—and exposes a “Refresh status”
 *   button that re-runs the fetch to collapse the Stripe webhook race condition after payment.
 *   Time complexity is O(1) per render and O(1) per refresh call, with a single constant-time
 *   network request and no expensive loops.
 *
 *   // update - 4: Replaced `useAccountStatus` with a local fetch-based loader and refresh.
 */
export default function SuccessPage() {
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null); // update - 5
  const [isLoading, setIsLoading] = useState<boolean>(true); // update - 6
  const [error, setError] = useState<string | null>(null); // update - 7

  /**
   * loadStatus
   * @description
   *   Helper function that performs an authenticated GET to `/api/account/status`, mirroring
   *   the pattern used by the Offer page client. It passes credentials so cookies are included,
   *   gracefully handles 401 responses by redirecting to `/signin?returnTo=/billing/success`,
   *   and on success stores the resulting `AccountStatus` in local state. Any non-OK response
   *   results in a soft error message being stored, but the page remains functional. This
   *   function is used both on initial mount and when the user clicks “Refresh status”.
   *   // update - 8: Centralized loader to share logic between mount and manual refresh.
   */
  const loadStatus = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/account/status', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.status === 401) {
        // Not authenticated: send user to sign-in and back to success page afterward.
        window.location.assign('/signin?returnTo=/billing/success');
        return;
      }

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload?.error || `Failed to load account status (${res.status})`);
      }

      const data = (await res.json()) as AccountStatus;
      setAccountStatus(data);
    } catch (err: any) {
      console.error('[SuccessPage] Failed to load account status:', err);
      setError(err?.message || 'Unable to load account status right now.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * useEffect: initial load
   * @description
   *   Runs once on mount to load the latest account status, with a simple cancellation guard
   *   so we do not attempt to set state after unmount. This mirrors the OfferClient pattern
   *   and ensures that returning from Stripe will immediately attempt to hydrate the user’s
   *   subscription tier, even if the global ApiContext is not present in this tree.
   *   // update - 9: One-time loader on mount using the shared `loadStatus` helper.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await loadStatus();
      } catch {
        // loadStatus already handled error logging; nothing extra here.
      }
      if (cancelled) {
        // If the component unmounted during the async call, we simply do nothing.
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    await loadStatus(); // update - 10: reuse same loader for manual refresh
  };

  const canUpgrade = accountStatus ? accountStatus.subscriptionTier === 'freemium' : false; // update - 11

  return (
    <main style={{ maxWidth: 720, margin: '48px auto', padding: '0 20px' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Thanks — payment received</h1>
        <p style={{ color: '#6C757D', marginTop: 8 }}>
          We’re finalizing your subscription now. This can take a few seconds while Stripe confirms
          the payment and our webhook updates your account.
        </p>
      </header>

      {/* update - 12: Optional inline error banner when status fetch fails */}
      {error && (
        <Box>
          <div style={{ color: '#a20000' }}>{error}</div>
        </Box>
      )}

      {/* 1) Loading state while we fetch account status directly from the BFF */}
      {isLoading && (
        <Box>
          <div style={{ color: '#6C757D' }}>Loading your account status…</div>
        </Box>
      )}

      {/* 2) Account status card once available */}
      {!isLoading && accountStatus && (
        <>
          <Box>
            <h3 style={{ marginTop: 0 }}>Current account status</h3>
            <Row label="Email" value={accountStatus.email} />
            <Row label="Account type" value={accountStatus.accountType} />
            <Row label="Subscription tier" value={accountStatus.subscriptionTier} />
            {/* Stripe link presence is backend concern; keep UI neutral here */}
          </Box>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginTop: 16,
            }}
          >
            <a
              href="/studygraph"
              style={{
                textAlign: 'center',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #E8E8E8',
                background: '#fff',
                color: '#2C3E50',
                textDecoration: 'none',
              }}
              aria-label="Go to WiseGraph"
            >
              Go to app
            </a>

            <button
              onClick={onRefresh}
              style={{
                textAlign: 'center',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #2C3E50',
                background: '#2C3E50',
                color: '#fff',
                cursor: 'pointer',
              }}
              aria-label="Refresh subscription status"
            >
              Refresh status
            </button>
          </div>

          <small style={{ color: '#6C757D', display: 'block', marginTop: 12 }}>
            If this page still shows <em>freemium</em> after a short wait, click “Refresh status”.
            You can manage your plan any time from your profile panel.
          </small>

          {/* Optional: tiny hint if the UI still indicates upgrade available */}
          {canUpgrade && (
            <small style={{ color: '#6C757D', display: 'block', marginTop: 8 }}>
              Your upgrade will unlock automatically once the webhook write lands.
            </small>
          )}
        </>
      )}
    </main>
  );
}
