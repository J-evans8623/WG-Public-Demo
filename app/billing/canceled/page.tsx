// app/(billing)/canceled/page.tsx
/**
 * @file app/(billing)/canceled/page.tsx
 * @description
 *   “Canceled” outcome page for WiseGraph’s checkout flow. Users land here when they back out of
 *   Stripe Checkout or the payment cannot proceed and Stripe redirects to the configured `cancel_url`.
 *   The goal is to maintain trust, clearly explain that no charge was made, and provide a frictionless
 *   path to try again or return to the app. We intentionally do not require authentication on this page;
 *   it is a safe, static handoff screen. The actions route users to the Offer page for another attempt
 *   or back into the app. Styling is minimal and brand-neutral to preserve existing CSS and avoid
 *   global style coupling. No PCI data is handled here.
 *
 *   Responsibilities:
 *   1) Reassure the user that the payment was not completed.
 *   2) Offer clear next steps: retry on the Offer page or go back to the app.
 *   3) Avoid any server calls or auth gating; this is a simple UX endpoint.
 */

import React from "react";

export const metadata = {
  title: "WiseGraph — Checkout canceled",
  description: "Your payment was canceled. You can try again anytime.",
};

export default function CanceledPage() {
  return (
    <main style={{ maxWidth: 720, margin: "48px auto", padding: "0 20px" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Payment canceled</h1>
        <p style={{ color: "#6C757D", marginTop: 8 }}>
          No charge was made. You can try again below or keep using WiseGraph.
        </p>
      </header>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
        <a
          href="/billing/offer"
          style={{
            textAlign: "center",
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #2C3E50",
            background: "#2C3E50",
            color: "#fff",
            textDecoration: "none",
          }}
          aria-label="Try checkout again"
        >
          Try again
        </a>

        <a
          href="/studygraph"
          style={{
            textAlign: "center",
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #E8E8E8",
            background: "#fff",
            color: "#2C3E50",
            textDecoration: "none",
          }}
          aria-label="Return to WiseGraph"
        >
          Return to app
        </a>
      </div>
    </main>
  );
}
