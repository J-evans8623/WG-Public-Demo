// app/cookie-preferences/page.tsx

import React from 'react';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import '@/app/styles/legal/legal-shared.css'; // Reusing your existing legal styles

/**
 * @file app/cookie-preferences/page.tsx
 * @description Public page explaining the application's use of cookies.
 * Clarifies that only essential cookies (authentication/security) are used.
 */

export default function CookiePreferencesPage() {
  return (
    <div className="wg-legal-page">
      <SiteHeader />
      
      <div className="wg-legal-container">
        <h1 className="wg-legal-main-title">Cookie Preferences</h1>
        <span className="wg-legal-last-updated">Last Updated: November 22, 2025</span>

        <section className="wg-legal-section">
          <h2 className="wg-legal-heading">Our Approach to Cookies</h2>
          <p className="wg-legal-text">
            At Wisegraph, we believe in keeping your data footprint minimal. We do not use third-party advertising cookies or sell your browsing data.
          </p>
          <p className="wg-legal-text">
            We use a <strong>minimal set of essential cookies</strong> strictly necessary to provide our service. These cookies are required for:
          </p>
          <ul className="wg-legal-list">
            <li><strong>Authentication:</strong> Verifying your identity so you can log in and access your secure account.</li>
            <li><strong>Security:</strong> Preventing cross-site request forgery (CSRF) and other malicious attacks.</li>
            <li><strong>Session Management:</strong> Keeping you signed in as you navigate between pages.</li>
          </ul>
        </section>

        <section className="wg-legal-section">
          <h2 className="wg-legal-heading">Managing Preferences</h2>
          <p className="wg-legal-text">
            Because these cookies are strictly necessary for the website to function (e.g., we cannot log you in without a session token), they cannot be disabled within our system. You may be able to block them via your browser settings, but doing so will prevent you from logging into Wisegraph.
          </p>
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}