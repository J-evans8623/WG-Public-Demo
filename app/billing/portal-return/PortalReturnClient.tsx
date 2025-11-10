'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

interface AccountStatusResponse {
  email: string;
  accountType: 'scholar' | 'educator';
  subscriptionTier: 'freemium' | 'premium';
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
      <div style={{ color: '#6C757D' }}>{label}</div>
      <div>{value}</div>
    </div>
  );
}

export default function PortalReturnClient() {
  const [accountStatus, setAccountStatus] = useState<AccountStatusResponse | null>(null);
  const { data: session, status } = useSession();
  const router = useRouter();

  // Auth guard
  useEffect(() => {
    if (status === 'loading') return;
    const email = session?.user?.email?.trim().toLowerCase();
    if (status === 'unauthenticated' || !email) {
      const returnTo = encodeURIComponent('/billing/offer');
      router.replace(`/signin?returnTo=${returnTo}`);
    }
  }, [status, session?.user?.email, router]);

  // Load account status
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

        if (!res.ok) return;

        const data = (await res.json()) as AccountStatusResponse;
        if (!cancelled) {
          setAccountStatus(data ?? null);
        }
      } catch (err) {
        console.warn('[PortalReturn] Failed to load account status:', err);
      }
    };

    loadStatus();

    return () => {
      cancelled = true;
    };
  }, [status]);

  return (
    <main style={{ maxWidth: 720, margin: '48px auto', padding: '0 20px' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Billing updated</h1>
        <p style={{ color: '#6C757D', marginTop: 8 }}>
          Your changes have been saved. If you just changed plans or canceled, your account
          will reflect this shortly
        </p>
      </header>

      {accountStatus && (
        <>
          <section
            style={{
              border: '1px solid #E8E8E8',
              background: '#fff',
              borderRadius: 12,
              padding: 20,
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              marginBottom: 16,
            }}
          >
            <h3 style={{ marginTop: 0 }}>Current account status</h3>
            <Row label="Email" value={accountStatus.email} />
            <Row label="Account type" value={accountStatus.accountType} />
            <Row label="Subscription tier" value={accountStatus.subscriptionTier} />
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <a
              href="/studygraph"
              style={{
                textAlign: 'center',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #E8E8E8',
                background: '#fff',
                color: '#2C3E50',
                textDecoration: 'none',
              }}
              aria-label="Go to WiseGraph"
            >
              Go to app
            </a>
          </div>
        </>
      )}
    </main>
  );
}
