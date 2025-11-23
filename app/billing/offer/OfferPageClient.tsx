// app/(billing)/offer/OfferPageClient.tsx

'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react'; // update - 1: Import signOut
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

type AccountStatusShape = {
  billing: {
    priceId?: string | null;
  } | null;
};

async function startCheckout(priceId: string): Promise<string> {
  const res = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId }),
  });

  if (res.status === 401) {
    // Hard redirect on 401 to ensure clean state
    window.location.href = '/signin?returnTo=/billing/offer';
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

export default function OfferPageClient({ planConfig }: Props) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const redirectInitiated = useRef(false); // Prevent double-firing

  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [busyPlan, setBusyPlan] = useState<'scholar' | 'educator' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPriceId, setCurrentPriceId] = useState<string | null>(null);

  // update - 2: Handle Sign Out
  const handleSignOut = async () => {
    // Sign out and redirect back to this page (which will then trigger the auth guard to send them to signin)
    // or directly to signin. Let's go to signin for a clean switch.
    await signOut({ callbackUrl: '/signin?returnTo=/billing/offer' });
  };

  /**
   * Enhanced Auth Guard
   * Use window.location.href for auth redirects to break client-side routing loops.
   * Added a ref to ensure we only trigger this once.
   */
  useEffect(() => {
    if (status === 'loading') return;

    // Use strict check: if explicitly unauthenticated OR authenticated but missing email
    const isInvalidSession = status === 'unauthenticated' || (status === 'authenticated' && !session?.user?.email);

    if (isInvalidSession && !redirectInitiated.current) {
      redirectInitiated.current = true;
      const returnTo = encodeURIComponent('/billing/offer');
      // Force a hard navigation to clear client state
      window.location.href = `/signin?returnTo=${returnTo}`;
    }
  }, [status, session]);

  // Fetch Account Status (Only when authenticated)
  useEffect(() => {
    if (status !== 'authenticated') return;

    let cancelled = false;
    const loadStatus = async () => {
      try {
        const res = await fetch('/api/account/status', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) return;

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
    return () => { cancelled = true; };
  }, [status]);

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

  // Stable Loading State
  if (status === 'loading' || (status === 'unauthenticated' && !session)) {
    return (
      <main className="offer-page">
        <div className="offer-container" style={{ textAlign: 'center', marginTop: '100px' }}>
          <div className="offer-toggle-btn active" style={{ display: 'inline-block', cursor: 'default' }}>
            {status === 'loading' ? 'Checking session...' : 'Redirecting to login...'}
          </div>
        </div>
      </main>
    );
  }

  // If we passed the guard but explicitly have no email (edge case), don't render content
  if (!session?.user?.email) return null;

  // Logic for determining current plan button state
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
    if (scholarPriceIds.includes(currentPriceId)) currentPlanType = 'scholar';
    else if (educatorPriceIds.includes(currentPriceId)) currentPlanType = 'educator';
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
        
        {/* update - 3: Header with Account Context */}
        <div className="offer-top-bar" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem', color: '#555' }}>
             <span>Signed in as <strong>{session.user.email}</strong></span>
             <button 
               onClick={handleSignOut}
               style={{ 
                 background: 'none', 
                 border: 'none', 
                 textDecoration: 'underline', 
                 color: '#E34432', 
                 cursor: 'pointer',
                 padding: 0,
                 fontSize: 'inherit'
               }}
             >
               Sign out
             </button>
           </div>
        </div>

        <header className="offer-header">
          <h1 className="offer-title">Choose your plan</h1>
          <p className="offer-subtitle">
            Your payment is processed securely by Stripe. You can manage or cancel anytime.
          </p>

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

        {error && (
          <div className="offer-error" role="alert">
            {error}
          </div>
        )}

        <div className="offer-plans-grid">
          {/* Scholar Plan */}
          <div className={`offer-plan-card ${scholarIsCurrent ? 'premium' : ''}`}>
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
            >
              {scholarButtonLabel}
            </button>
          </div>

          {/* Educator Plan */}
          <div className={`offer-plan-card ${educatorIsCurrent ? 'premium' : ''}`}>
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
            >
              {educatorButtonLabel}
            </button>
          </div>
        </div>

        <div className="offer-footer-note">
          Exact limits may evolve; we document changes in the Changelog first. No testimonials. No bait-and-switch.
        </div>
      </div>
    </main>
  );
}