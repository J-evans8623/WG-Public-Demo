// app/(marketing)/welcome/page.tsx
'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import './welcome.css';

export default function Page() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');

  return (
    <>
      <Head>
        <title>WiseGraph - organize, learn, and revise—without the chaos</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-left">
              <h1>
                <span className="brand-name">WiseGraph</span>
                <br />
                organize, learn, and revise—without the chaos.
              </h1>
              <p>Concept-map notebooks, lesson generation, a planner and study groups—together at last.</p>

              <div className="cta-buttons">
                <a href="#" className="btn-primary" aria-label="Start free">
                  Start free
                </a>
                <a href="#" className="btn-secondary" aria-label="View pricing">
                  View pricing
                </a>
              </div>

              <p className="disclaimer">No credit card for free tier. Rate limits disclosed below.</p>
            </div>

            <div className="hero-right" aria-hidden="true">
              <div className="mockup-frame">
                <div className="concept-map">
                  <div className="node">Idea 1</div>
                  <div className="connection" />
                  <div className="node secondary">Idea</div>
                </div>
                <div className="chart-area" role="img" aria-label="Progress chart mock">
                  <div className="bar" />
                  <div className="bar" />
                  <div className="bar" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <div className="feature-cards">
            <div className="feature-card">
              <svg className="feature-icon" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
                  stroke="currentColor"
                />
              </svg>
              <h3>Generate Lessons from your notes</h3>
              <p>Create structured lessons directly from your notebooks.</p>
            </div>

            <div className="feature-card">
              <svg className="feature-icon" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5"
                  stroke="currentColor"
                />
              </svg>
              <h3>Plan smarter with the Study Planner</h3>
              <p>See how it schedules blocks & interleaves.</p>
            </div>

            <div className="feature-card">
              <svg className="feature-icon" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                  stroke="currentColor"
                />
              </svg>
              <h3>Start a Study Group</h3>
              <p>Live collaboration + sharing.</p>
            </div>
          </div>

          <div className="proof-tiles">
            <div className="proof-tile">
              <h4>Notebooks</h4>
              <p>Organized learning</p>
            </div>
            <div className="proof-tile">
              <h4>Color-coded subjects</h4>
              <p>Visual organization</p>
            </div>
            <div className="proof-tile">
              <h4>Favorites & Recents</h4>
              <p>Quick access</p>
            </div>
            <div className="proof-tile">
              <h4>Quick actions</h4>
              <p>Streamlined workflow</p>
            </div>
          </div>
        </div>
      </section>

      {/* Honesty Strip */}
      <section className="honesty-strip" aria-label="Policy highlights">
        <div className="container">
          <div className="honesty-content">
            <div className="honesty-item">
              <div className="honesty-bullet" />
              <span>Clear quotas</span>
            </div>
            <div className="honesty-item">
              <div className="honesty-bullet" />
              <span>Portable data (export)</span>
            </div>
            <div className="honesty-item">
              <div className="honesty-bullet" />
              <span>No ads / no bait-and-switch</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="pricing-section">
        <div className="container">
          <h2>Choose Your Plan</h2>

          <div className="pricing-toggle" role="tablist" aria-label="Billing period">
            <div className="toggle-container">
              <button
                type="button"
                role="tab"
                aria-selected={billing === 'monthly'}
                className={`toggle-option ${billing === 'monthly' ? 'active' : ''}`}
                onClick={() => setBilling('monthly')}
              >
                Monthly
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={billing === 'annual'}
                className={`toggle-option ${billing === 'annual' ? 'active' : ''}`}
                onClick={() => setBilling('annual')}
              >
                Annual <small>(10% off)</small>
              </button>
            </div>
          </div>

          <div className="pricing-cards">
            <div className="pricing-card">
              <h3>Free</h3>
              <div className="price">
                $0<span className="price-subtext">/month</span>
              </div>
              <ul className="feature-list">
                <li>50 lessons</li>
                <li>25 lessons</li>
                <li>No planner</li>
                <li>Basic features</li>
              </ul>
              <a href="#" className="btn-secondary block-button" aria-label="Upgrade to Free">
                Upgrade
              </a>
            </div>

            <div className="pricing-card">
              <h3>Scholar Premium</h3>
              <div className="price">
                {billing === 'annual' ? '$10.80' : '$12'}
                <span className="price-subtext">/month</span>
              </div>
              <ul className="feature-list">
                <li>Unlimited lessons</li>
                <li>Full planner access</li>
                <li>Study groups</li>
                <li>Priority support</li>
              </ul>
              <a href="#" className="btn-primary block-button" aria-label="Upgrade to Scholar Premium">
                Upgrade
              </a>
            </div>

            <div className="pricing-card">
              <h3>Educator Premium</h3>
              <div className="price">
                {billing === 'annual' ? '$22.50' : '$25'}
                <span className="price-subtext">/month</span>
              </div>
              <ul className="feature-list">
                <li>600 lessons</li>
                <li>Advanced analytics</li>
                <li>Unlimited groups</li>
                <li>White-label options</li>
              </ul>
              <a href="#" className="btn-secondary block-button" aria-label="Contact us for Educator Premium">
                Contact us
              </a>
            </div>
          </div>

          <p className="pricing-footnote">Exact limits may evolve; changes appear in the Changelog first.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <a href="#" className="footer-link">
              Docs
            </a>
            <a href="#" className="footer-link">
              Changelog
            </a>
            <a href="#" className="footer-link">
              Privacy
            </a>
            <a href="#" className="footer-link">
              Terms
            </a>
            <a href="#" className="footer-link">
              Accessibility
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
