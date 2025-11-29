'use client';

/**
 * @file app/billing/success/page.tsx
 * @description
 * Static confirmation page.
 * * DESIGN STRATEGY: "Play it safe."
 * We do not fetch account status here to avoid race conditions (latency) where the 
 * DB hasn't updated the subscription tier yet. Instead, we show a generic, warm 
 * success message and forward the user to the app.
 */

import React from 'react';
import './success-page.css';

// -- Icons --
const Icons = {
  CheckCircle: () => (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  ),
  ArrowRight: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginLeft: 8}}>
      <line x1="5" y1="12" x2="19" y2="12"></line>
      <polyline points="12 5 19 12 12 19"></polyline>
    </svg>
  )
};

export default function SuccessPage() {
  return (
    <main className="sp-page">
      <div className="sp-container">
        <div className="sp-card">
          
          <div className="sp-icon-wrapper">
            <Icons.CheckCircle />
          </div>

          <h1 className="sp-title">You’re all set</h1>
          
          <p className="sp-subtitle">
            Thanks for upgrading your account. We’ve received your payment and your new features are being unlocked now.
          </p>

          <a href="/workspace" className="sp-cta-btn">
            Return to Workspace
            <Icons.ArrowRight />
          </a>

        </div>
      </div>
    </main>
  );
}