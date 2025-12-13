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

import React, { useEffect } from 'react'
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

  useEffect(() => {
    // 1. Retrieve the stored ad context from the landing page capture
    const storedContext = localStorage.getItem('wisegraph_ad_context');
    
    if (storedContext) {
      try {
        const { gclid } = JSON.parse(storedContext);

        // 2. Fire Google Ads Event only if a valid GCLID was captured
        // We rely on window.gtag being available from the global layout script
        if (gclid && typeof window !== 'undefined' && (window as any).gtag) {
           (window as any).gtag('event', 'conversion', {
              'send_to': 'AW-17797042132/yVVBCLjojtAbENSfpaZC',
              'transaction_id': '', // Optional: Transaction ID left blank as this is a static success page
           });
           
           // 3. Cleanup: Remove the context to ensure this event is exactly one-time use.
           localStorage.removeItem('wisegraph_ad_context');
        }
      } catch (e) {
        console.error('Error parsing ad context on success page:', e);
      }
    }
  }, []);
  
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