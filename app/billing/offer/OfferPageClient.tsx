// app/(billing)/offer/OfferPageClient.tsx
/**
 * @file app/(billing)/offer/OfferPageClient.tsx
 * @description
 * Client component for the WiseGraph Pricing Page.
 * Updated Phase 6: Removed Starter free tier in favour of a 3-day trial model.
 * - SchoolBanner is placed ABOVE the wg-pricing-layout grid so it spans the full
 *   width without disturbing the existing two-column grid structure.
 * - Cards grid switches to repeat(2, 1fr) since only two tiers remain. Scholar
 *   card receives a subtle visual elevation to resolve the isolation effect.
 */
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import './pricing.css';
import Link from 'next/link';
import SchoolBanner from '@/app/(welcome)/draft/landingPageB/SchoolBanner';

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
  paymentsEnabled: boolean;
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
  "Create or Join Study groups",
  "Standard Rate Limits",
];

const EDUCATOR_FEATURES = [
  "Unlimited AI Lesson Generation",
  "Visual AI Concept Mapping",
  "Smart Spaced-Repetition Planner",
  "On-Demand AI Tutor",
  "Self-Paced Quiz Generation",
  "Real-Time Peer Collaboration",
  "Create or Join Study groups",
  "Track student performance on quiz assessments with a gradebook",
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

  if (res.status === 503) {
    throw new Error('Payments are temporarily disabled for system verification.');
  }
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
  if (!data?.url) throw new Error('Checkout URL missing in server response.');
  return data.url;
}

export default function OfferPageClient({ planConfig, paymentsEnabled }: Props) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const redirectInitiated = useRef(false);

  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [busyPlan, setBusyPlan] = useState<'scholar' | 'educator' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPriceId, setCurrentPriceId] = useState<string | null>(null);
  const [hasUsedTrial, setHasUsedTrial] = useState<boolean>(false);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/signin?returnTo=/billing/offer' });
  };

  useEffect(() => {
    if (status === 'loading') return;
    const isInvalidSession =
      status === 'unauthenticated' ||
      (status === 'authenticated' && !session?.user?.email);
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
        const data = (await res.json())
        if (!cancelled) 
          setCurrentPriceId(data?.billing?.priceId ?? null);
        setHasUsedTrial(data?.hasUsedTrial ?? false);
      } catch (err) {
        console.warn('[OfferPageClient] Failed to load account status:', err);
      }
    };

    loadStatus();
    return () => { cancelled = true; };
  }, [status]);



  /**
   * getButtonText
   * @description
   * Determines the appropriate call-to-action label for a specific plan card based on the 
   * user's current subscription status and their one-time trial eligibility. This function 
   * serves as the final gatekeeper for the UI, ensuring that ineligible users are not 
   * promised a trial they cannot claim. It performs this string resolution in O(1) time 
   * complexity and provides immediate feedback during the plan selection process.
   */
  /* UPDATE - 8.3: Implementation of dynamic CTA text */
  const getButtonText = (planType: 'scholar' | 'educator', isCurrent: boolean, isBusy: boolean) => {
    if (isCurrent) return 'Current Plan';
    if (isBusy) return 'Processing...';
    
    // If the user hasn't used their trial, show the promotional text
    if (!hasUsedTrial) return 'Start 3-Day Free Trial';
    
    // Fallback for returning customers or those who already exhausted their trial
    return 'Subscribe Now';
  };

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

  const scholarPriceIds = [planConfig.scholar.monthly.priceId, planConfig.scholar.annual.priceId];
  const educatorPriceIds = [planConfig.educator.monthly.priceId, planConfig.educator.annual.priceId];

  let currentPlanType: 'scholar' | 'educator' | null = null;
  if (currentPriceId) {
    if (scholarPriceIds.includes(currentPriceId)) currentPlanType = 'scholar';
    else if (educatorPriceIds.includes(currentPriceId)) currentPlanType = 'educator';
  }

  const scholarIsBusy = busyPlan === 'scholar';
  const educatorIsBusy = busyPlan === 'educator';
  const scholarIsCurrent = currentPlanType === 'scholar';
  const educatorIsCurrent = currentPlanType === 'educator';


  // Shared inline-style object for the audience descriptor tag rendered beneath
// each card title. Keeps both descriptors visually consistent and avoids
// duplicating style literals. Sources existing CSS custom properties so the
// descriptor inherits any future theme-level colour changes automatically.
// Positioned just below the title, deliberately smaller and muted so it reads
// as supporting context rather than a competing heading.
const audienceTagStyle: React.CSSProperties = {
  fontSize: '0.72rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--wg-text-muted, #888)',
  marginTop: '2px',
  marginBottom: '4px',
};

  return (
    <main className="wg-pricing-page">
      <div className="wg-pricing-container">

        {/* ── Top user bar ───────────────────────────────────────────── */}
        <div className="wg-top-bar-container">
          <div className="wg-user-pill">
            <span>Signed in as <strong>{session.user.email}</strong></span>
            <button
              onClick={handleSignOut}
              style={{
                background: 'none',
                border: 'none',
                textDecoration: 'underline',
                color: 'var(--wg-accent-red)',
                cursor: 'pointer',
                padding: 0,
                fontSize: 'inherit',
              }}
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

      

        {/* ── Two-column pricing layout (unchanged grid structure) ───── */}
        <div className="wg-pricing-layout">

          {/* Left sticky column: narrative panel */}
          <section className="wg-pricing-intro">
            <h1 className="wg-pricing-title">Start building lasting mastery today.</h1>
            <p className="wg-pricing-subtitle">
              Try any plan free for 3 days. No credit card charges until your trial ends.
            </p>
          </section>

          {/* Right column: billing toggle + cards */}
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
                  Annual <small>(save 50%)</small>
                </button>
              </div>
            </div>

            {/*
             * Override grid-template-columns to repeat(2, 1fr) since the
             * Starter card is gone. Scholar is lifted via translateY + stronger
             * shadow to serve as the visual anchor — restoring the hierarchy
             * that a three-card layout provides through its middle option.
             */}
            <div className="wg-cards-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>

              {/* ── Scholar Premium (elevated / featured) ─────────────── */}
              <div
                className="wg-paper-card scholar"
                style={{
                  transform: 'translateY(-6px)',
                  boxShadow: '0 12px 36px rgba(0,0,0,0.13)',
                }}
              >
                <div className="wg-card-badge">Most Popular</div>
                <div className="wg-card-header">
                  <h3 className="wg-card-title">Scholar Premium</h3>
                   <p style={audienceTagStyle}>For Students &amp; Self-Learners</p>
                  <div className="wg-price-container">
                    {billing === 'annual' ? (
                      <>
                        <div className="wg-price-group">
                          <span className="wg-price-anchor">$9.99</span>
                          <span className="wg-price-hero">$5.00</span>
                          <span className="wg-price-period">USD/mo</span>
                        </div>
                        <span className="wg-price-subtext">($59.99 USD/yr)</span>
                      </>
                    ) : (
                      <div className="wg-price-group">
                        <span className="wg-price-hero" style={{ color: 'var(--wg-text-main)' }}>$9.99</span>
                        <span className="wg-price-period">USD/mo</span>
                      </div>
                    )}
                  </div>
                </div>
                <ul className="wg-feature-list">
                  {SCHOLAR_FEATURES.map((item, idx) => (
                    <li key={idx} className="wg-feature-item">{item}</li>
                  ))}
                </ul>
                {paymentsEnabled ? (
                  <button
                    className="wg-card-btn wg-btn-primary-p"
                    onClick={() => handlePlanSelect('scholar')}
                    disabled={scholarIsBusy || scholarIsCurrent}
                  >
                    {getButtonText('scholar', scholarIsCurrent, scholarIsBusy)}
                  </button>
                ) : (
                  <button className="wg-card-btn wg-btn-primary-p" disabled>Coming Soon</button>
                )}
              </div>

              {/* ── Educator Premium ───────────────────────────────────── */}
              <div className="wg-paper-card educator">
                <div className="wg-card-header">
                  <h3 className="wg-card-title">Educator Premium</h3>
                   <p style={audienceTagStyle}>For Teachers &amp; Professors</p>
                  <div className="wg-price-container">
                    {billing === 'annual' ? (
                      <>
                        <div className="wg-price-group">
                          <span className="wg-price-anchor">$12.99</span>
                          <span className="wg-price-hero">$6.50</span>
                          <span className="wg-price-period">USD/mo</span>
                        </div>
                        <span className="wg-price-subtext">($77.95 USD/yr)</span>
                      </>
                    ) : (
                      <div className="wg-price-group">
                        <span className="wg-price-hero" style={{ color: 'var(--wg-text-main)' }}>$12.99</span>
                        <span className="wg-price-period">USD/mo</span>
                      </div>
                    )}
                  </div>
                </div>
                <ul className="wg-feature-list">
                  {EDUCATOR_FEATURES.map((item, idx) => (
                    <li key={idx} className="wg-feature-item">{item}</li>
                  ))}
                </ul>
                {paymentsEnabled ? (
                  <button
                    className="wg-card-btn wg-btn-primary-p"
                    onClick={() => handlePlanSelect('educator')}
                    disabled={educatorIsBusy || educatorIsCurrent}
                  >
                    {getButtonText('educator', educatorIsCurrent, educatorIsBusy)}
                  </button>
                ) : (
                  <button className="wg-card-btn wg-btn-primary-p" disabled>Coming Soon</button>
                )}
              </div>

            </div>
          </section>

        </div>

  {/*
         * SchoolBanner sits OUTSIDE wg-pricing-layout so it spans the full
         * container width without being slotted into a grid column.
         * Margin-bottom aligns it with the rhythm of the layout below.
         */}
        <div style={{ marginTop: '100px'}}>
          <SchoolBanner />
        </div>

      </div>
    </main>
  );
}