/**
 * @file app/(billing)/offer/OfferPageClient.tsx
 * @description
 *   Client shell for the Offer page. Enforces auth, manages billing toggle state,
 *   renders 2 plan tiles (Scholar/Educator) with monthly/annual options using the
 *   up-to-date styling from offer.css, and:
 *     - Calls `/api/account/status` to determine the user’s current plan.
 *     - Disables and labels the tile that matches the active subscription **by plan type
 *       (Scholar vs Educator), regardless of interval (monthly vs annual)**.
 *     - Handles 401 + 409 errors from `/api/stripe/checkout` gracefully.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import './offer.css';

/**
 * Type definition for plan configuration passed from server
 */
type PlanConfig = {
  scholar: {
    monthly: { price: string; priceId: string };
    annual: { price: string; priceId: string };
  };
  educator: {
    monthly: { price: string; priceId: string };
    annual: { price: string; priceId: string };
  };
};

interface Props {
  planConfig: PlanConfig;
}

/**
 * Minimal shape of /api/account/status response we care about
 * for determining the current Stripe priceId.
 */
type AccountStatusShape = {
  billing: {
    priceId?: string | null;
  } | null;
};

/**
 * startCheckout
 * @purpose
 *   Post the chosen `priceId` to the authenticated API and redirect to Stripe
 *   Checkout when a URL is returned. This helper:
 *     - Redirects to `/signin` if the backend reports 401.
 *     - Surfaces a specific message for 409 "already subscribed" responses.
 *     - Throws on other non-OK responses so the caller can show inline errors.
 */
async function startCheckout(priceId: string): Promise<string> {
  const res = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId }),
  });

  if (res.status === 401) {
    window.location.assign('/signin?returnTo=/billing/offer');
    throw new Error('Authentication required.');
  }

  if (res.status === 409) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      payload?.error ||
        'You are already subscribed to this plan. Please use the billing portal to manage your subscription.'
    );
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload?.error || 'Unable to create checkout session.');
  }

  const data = (await res.json()) as { url?: string };
  if (!data?.url) {
    throw new Error('Checkout URL missing in server response.');
  }

  return data.url;
}

/**
 * OfferPageClient Component
 * Main client component that renders the offer page with plan selection,
 * styling from offer.css, and correct "current plan type" disabling behavior.
 */
export default function OfferPageClient({ planConfig }: Props) {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [busyPlan, setBusyPlan] = useState<'scholar' | 'educator' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPriceId, setCurrentPriceId] = useState<string | null>(null);

  /**
   * Authentication guard - redirect unauthenticated users
   */
  useEffect(() => {
    if (status === 'loading') return;
    const email = session?.user?.email?.trim().toLowerCase();
    if (status === 'unauthenticated' || !email) {
      const returnTo = encodeURIComponent('/billing/offer');
      router.replace(`/signin?returnTo=${returnTo}`);
    }
  }, [status, session?.user?.email, router]);

  /**
   * Load account status to determine active Stripe priceId.
   * If this fails, we simply leave all plans enabled.
   */
  useEffect(() => {
    if (status !== 'authenticated') return;

    let cancelled = false;

    const loadStatus = async () => {
      try {
        const res = await fetch('/api/account/status', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (!res.ok) {
          // Degrade gracefully (e.g., 401 from backend)
          return;
        }

        const data = (await res.json()) as AccountStatusShape;
        if (!cancelled) {
          const priceFromBilling = data?.billing?.priceId ?? null;
          setCurrentPriceId(priceFromBilling);
        }
      } catch (err) {
        console.warn('[OfferPageClient] Failed to load account status:', err);
      }
    };

    loadStatus();

    return () => {
      cancelled = true;
    };
  }, [status]);

  /**
   * handlePlanSelect
   * @purpose
   *   Handles plan selection and initiates checkout flow
   */
  const handlePlanSelect = async (planKey: 'scholar' | 'educator') => {
    setError(null);
    setBusyPlan(planKey);

    try {
      const priceId = planConfig[planKey][billing].priceId;
      const url = await startCheckout(priceId);
      window.location.assign(url);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setBusyPlan(null);
    }
  };

  // Loading state during auth check
  if (status === 'loading') {
    return (
      <main className="offer-page">
        <div className="offer-container">
          <p style={{ color: '#6C757D' }}>Checking your session…</p>
        </div>
      </main>
    );
  }

  // Don't render if not authenticated
  if (status === 'unauthenticated' || !session?.user?.email) return null;

  /**
   * Determine current plan **by plan type**, not by interval.
   * If currentPriceId matches either scholar monthly OR scholar annual,
   * we treat the Scholar card as "current" for both toggles.
   * Same for Educator.
   */
  const scholarPriceIds = [
    planConfig.scholar.monthly.priceId,
    planConfig.scholar.annual.priceId,
  ];
  const educatorPriceIds = [
    planConfig.educator.monthly.priceId,
    planConfig.educator.annual.priceId,
  ];

  let currentPlanType: 'scholar' | 'educator' | null = null;
  if (currentPriceId) {
    if (scholarPriceIds.includes(currentPriceId)) {
      currentPlanType = 'scholar';
    } else if (educatorPriceIds.includes(currentPriceId)) {
      currentPlanType = 'educator';
    }
  }

  const scholarIsBusy = busyPlan === 'scholar';
  const educatorIsBusy = busyPlan === 'educator';

  const scholarIsCurrent = currentPlanType === 'scholar';
  const educatorIsCurrent = currentPlanType === 'educator';

  const scholarButtonLabel = scholarIsCurrent
    ? 'Current plan'
    : scholarIsBusy
    ? 'Processing…'
    : 'Continue to Checkout';

  const educatorButtonLabel = educatorIsCurrent
    ? 'Current plan'
    : educatorIsBusy
    ? 'Processing…'
    : 'Continue to Checkout';

  return (
    <main className="offer-page">
      <div className="offer-container">
        {/* Header Section */}
        <header className="offer-header">
          <h1 className="offer-title">Choose your plan</h1>
          <p className="offer-subtitle">
            Your payment is processed securely by Stripe. You can manage or cancel anytime in the Billing Portal.
          </p>

          {/* Billing toggle matching welcome page */}
          <div className="offer-toggle">
            <button
              type="button"
              className={`offer-toggle-btn ${billing === 'monthly' ? 'active' : ''}`}
              onClick={() => setBilling('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={`offer-toggle-btn ${billing === 'annual' ? 'active' : ''}`}
              onClick={() => setBilling('annual')}
            >
              Annual <small>(save 20%)</small>
            </button>
          </div>
        </header>

        {/* Error Display */}
        {error && (
          <div className="offer-error" role="alert">
            {error}
          </div>
        )}

        {/* Two-plan grid (Scholar / Educator) */}
        <div className="offer-plans-grid">
          {/* Scholar Plan */}
          <div className="offer-plan-card premium">
            <div className="offer-card-label">Most popular</div>
            <div className="offer-card-icon">🎓</div>
            <h3 className="offer-card-title">Scholar Premium</h3>
            <div className="offer-card-price">
              {planConfig.scholar[billing].price}
              <span className="offer-price-period">
                /{billing === 'monthly' ? 'mo' : 'yr'}
              </span>
            </div>
            <ul className="offer-card-features">
              <li>Premium subscription: monthly cap + free daily burst</li>
              <li>Full Study Planner (multi-notebook)</li>
              <li>Study Groups (invite collaborators)</li>
            </ul>
            {scholarIsCurrent && (
              <p style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>
                This is your current subscription.
              </p>
            )}
            <button
              className="offer-card-btn"
              onClick={() => handlePlanSelect('scholar')}
              disabled={scholarIsBusy || scholarIsCurrent}
              aria-label={
                scholarIsCurrent
                  ? 'Current plan: Scholar Premium'
                  : 'Select Scholar Premium'
              }
            >
              {scholarButtonLabel}
            </button>
          </div>

          {/* Educator Plan */}
          <div className="offer-plan-card premium">
            <div className="offer-card-label">For courses & cohorts</div>
            <div className="offer-card-icon">👥</div>
            <h3 className="offer-card-title">Educator Premium</h3>
            <div className="offer-card-price">
              {planConfig.educator[billing].price}
              <span className="offer-price-period">
                /{billing === 'monthly' ? 'mo' : 'yr'}
              </span>
            </div>
            <ul className="offer-card-features">
              <li>Premium + higher daily burst</li>
              <li>Planner for multiple classes</li>
              <li>Expanded collaboration spaces</li>
            </ul>
            {educatorIsCurrent && (
              <p style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>
                This is your current subscription.
              </p>
            )}
            <button
              className="offer-card-btn"
              onClick={() => handlePlanSelect('educator')}
              disabled={educatorIsBusy || educatorIsCurrent}
              aria-label={
                educatorIsCurrent
                  ? 'Current plan: Educator Premium'
                  : 'Select Educator Premium'
              }
            >
              {educatorButtonLabel}
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div className="offer-footer-note">
          Exact limits may evolve; we document changes in the Changelog first. No testimonials. No bait-and-switch.
        </div>
      </div>
    </main>
  );
}
