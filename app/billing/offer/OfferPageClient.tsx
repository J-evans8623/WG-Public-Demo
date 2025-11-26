// app/(billing)/offer/OfferPageClient.tsx

/**
 * @file app/(billing)/offer/OfferPageClient.tsx
 * @description
 * Client component for the WiseGraph Pricing Page.
 * Implements the "Comprehensive Ledger" design with an asymmetric layout and dense feature lists.
 * Updated Phase 3: Applied "User Pill" and structural classes for better readability against texture.
 */

'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import './pricing.css';

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

const SCHOLAR_FEATURES = [
  "Unlimited AI Lesson Generation",
  "Visual AI Concept Mapping",
  "Smart Spaced-Repetition Planner",
  "On-Demand AI Tutor",
  "Self-Paced Quiz Generation",
  "Real-Time Peer Collaboration",
  "Standard Rate Limits",
];

const EDUCATOR_FEATURES =  [
  "Unlimited AI Lesson Generation",
  "Visual AI Concept Mapping",
  "Smart Spaced-Repetition Planner",
  "On-Demand AI Tutor",
  "Self-Paced Quiz Generation",
  "Real-Time Peer Collaboration",
  "Track student performance on quiz assements with a gradebook",
  "Assignable Quizzes with Deadlines",
  "Manage permissions for all uploaded materials.",
  'Higher rate limits',
];

async function startCheckout(priceId: string): Promise<string> {
  const res = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ priceId }),
  });

  if (res.status === 401) {
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
  const redirectInitiated = useRef(false);

  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [busyPlan, setBusyPlan] = useState<'scholar' | 'educator' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPriceId, setCurrentPriceId] = useState<string | null>(null);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/signin?returnTo=/billing/offer' });
  };

  useEffect(() => {
    if (status === 'loading') return;
    const isInvalidSession = status === 'unauthenticated' || (status === 'authenticated' && !session?.user?.email);

    if (isInvalidSession && !redirectInitiated.current) {
      redirectInitiated.current = true;
      const returnTo = encodeURIComponent('/billing/offer');
      window.location.href = `/signin?returnTo=${returnTo}`;
    }
  }, [status, session]);

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

  if (status === 'loading' || (status === 'unauthenticated' && !session)) {
    return (
      <main className="wg-pricing-page">
         <div className="wg-pricing-container" style={{ display: 'flex', justifyContent: 'center', paddingTop: '100px' }}>
           <div className="wg-toggle-btn active" style={{ cursor: 'default' }}>
             {status === 'loading' ? 'Checking session...' : 'Redirecting...'}
           </div>
         </div>
      </main>
    );
  }

  if (!session?.user?.email) return null;

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

  return (
    <main className="wg-pricing-page">
      <div className="wg-pricing-container">
        
        {/* update - 1: Applied .wg-user-pill for readability against texture */}
        <div className="wg-top-bar-container">
          <div className="wg-user-pill">
            <span>Signed in as <strong>{session.user.email}</strong></span>
            <button 
              onClick={handleSignOut}
              style={{ background: 'none', border: 'none', textDecoration: 'underline', color: 'var(--wg-accent-red)', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}
            >
              Sign out
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <div className="wg-pricing-layout">
          
          {/* LEFT COLUMN: Narrative Panel */}
          {/* update - 2: Class applies the new solid panel styling */}
          <section className="wg-pricing-intro">
            <h1 className="wg-pricing-title">Start building lasting mastery today.</h1>
          </section>

          {/* RIGHT COLUMN: Grid & Controls */}
          <section>
            
            <div className="wg-pricing-controls">
              <div className="wg-toggle-group">
                <button
                  type="button"
                  className={`wg-toggle-btn ${billing === 'monthly' ? 'active' : ''}`}
                  onClick={() => setBilling('monthly')}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={`wg-toggle-btn ${billing === 'annual' ? 'active' : ''}`}
                  onClick={() => setBilling('annual')}
                >
                  Annual <small>(save 25%)</small>
                </button>
              </div>
            </div>

            <div className="wg-cards-grid">
              
              {/* Card 1: STARTER */}
              <div className="wg-paper-card starter">
                <div className="wg-card-header">
                  <h3 className="wg-card-title">Starter</h3>
                  <div className="wg-card-price">Free</div>
                </div>
                <ul className="wg-feature-list">
                   <li className="wg-feature-item">2 Lifetime Credits to create your first concept map</li>
                   <li className="wg-feature-item">Basic Features Access</li>
                   <li className="wg-feature-item">Community Access</li>
                </ul>
                <Link href="/signin?returnTo=/workspace" className="wg-card-btn wg-btn-outline">
                    Try free demo
                </Link>
                <span>
                  Terms and conditions apply.
                </span>
              </div>

              {/* Card 2: SCHOLAR PREMIUM */}
              <div className={`wg-paper-card scholar`}>
                <div className="wg-card-badge">Most Popular</div>
                <div className="wg-card-header">
                  <h3 className="wg-card-title">Scholar Premium</h3>
                  <div className="wg-card-price">
                    {planConfig.scholar[billing].price}
                    <span className="wg-card-period">/{billing === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                </div>
                <ul className="wg-feature-list">
                  {SCHOLAR_FEATURES.map((item, idx) => (
                    <li key={idx} className="wg-feature-item">{item}</li>
                  ))}
                </ul>
                <button
                  className="wg-card-btn wg-btn-primary"
                  onClick={() => handlePlanSelect('scholar')}
                  disabled={scholarIsBusy || scholarIsCurrent}
                >
                  {scholarIsCurrent ? 'Current Plan' : scholarIsBusy ? 'Processing...' : 'Continue to Checkout'}
                </button>
              </div>

              {/* Card 3: EDUCATOR PREMIUM */}
              <div className="wg-paper-card educator">
                <div className="wg-card-header">
                  <h3 className="wg-card-title">Educator Premium</h3>
                  <div className="wg-card-price">
                    {planConfig.educator[billing].price}
                    <span className="wg-card-period">/{billing === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                </div>
                <ul className="wg-feature-list">
                  {EDUCATOR_FEATURES.map((item, idx) => (
                    <li key={idx} className="wg-feature-item">{item}</li>
                  ))}
                </ul>
                <button
                  className="wg-card-btn wg-btn-primary"
                  onClick={() => handlePlanSelect('educator')}
                  disabled={educatorIsBusy || educatorIsCurrent}
                >
                  {educatorIsCurrent ? 'Current Plan' : educatorIsBusy ? 'Processing...' : 'Continue to Checkout'}
                </button>
              </div>

            </div>
            
          </section>
        </div>
      </div>
    </main>
  );
}