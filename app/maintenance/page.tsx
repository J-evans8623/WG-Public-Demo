/**
 * @file app/maintenance/page.tsx
 * @description
 * This file renders the client-facing "Maintenance Mode" interface. It acts as the
 * application's "Safety Valve" screen, displayed to users when the `MAINTENANCE_MODE`
 * environment variable is active.
 *
 * Design & Architecture:
 * - Uses the "Tan Card" aesthetic defined in `features-page.css` to maintain brand consistency
 * (WiseGraph "Scholar" & "Educator" feel) even during downtime.
 * - Intentionally designed as a Server Component with zero external data dependencies.
 * This ensures the page can render successfully even if the database or Redis
 * connections are completely severed.
 * - Utilizes inline styles and existing global CSS classes to avoid HTTP requests for
 * new stylesheets, ensuring fast loading during high-stress server scenarios.
 *
 * Responsibilities:
 * - Inform the user that the system is undergoing scheduled improvements.
 * - Mask underlying technical errors (DB migrations, schema breaks) behind a friendly UI.
 * - Maintain the "Crimson Text" and "Inter" typography hierarchy.
 *
 * @author System
 * @date Current
 */

import React from 'react';

// We assume features-page.css is loaded globally or via layout, 
// but we use standard HTML/Classes matching the provided context.

export default function MaintenancePage() {
  return (
    <main className="wg-feature-page" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="wg-container">
        {/* Using the "Tan Card" styling from features-page.css 
          centered in the viewport for maximum focus.
        */}
        <div className="wg-tan-card" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
          
          {/* Iconography: Simple SVG to indicate 'Construction' without external assets */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <svg 
              width="64" 
              height="64" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="var(--wg-accent-taupe)" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>

          {/* Typography: Matching the WiseGraph 'Crimson Text' header style */}
          <h1 className="wg-card-title" style={{ fontSize: '2.5rem', marginBottom: '16px' }}>
           We&apos;ll be right back.
          </h1>

          {/* Body: Softened, non-technical copy */}
          <p className="wg-card-body" style={{ marginBottom: '32px' }}>
            WiseGraph is currently undergoing scheduled maintenance. 
            <br /><br />
            Thank you for your patience we will be back online shortly.
          </p>

          <div className="wg-divider-line" style={{ width: '100%', margin: '0 0 24px 0' }} />

          {/* Action: Simple reload mechanism */}
          <div>
            <a 
              href="/" 
              className="wg-big-cta-btn"
              style={{ cursor: 'pointer' }}
            >
              Check Status
            </a>
          </div>

        </div>
      </div>
    </main>
  );
}