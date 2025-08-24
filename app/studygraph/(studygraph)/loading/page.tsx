'use client';

/**
 * @file page.tsx
 * @description
 * Route page for previewing the LoadingAnimation component family.
 * Renders the interactive LoadingExample so you can test overlay and
 * inline variants from a standalone page.
 */

import React from 'react';
import { LoadingAnimation } from '../LoadingAnimation';

export default function Page() {
  console.log('LoadingAnimation Demo Page mounted - LAPAGE001');

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#FEF9F3',
        display: 'flex',
        alignItems: 'stretch',
      }}
    >
      <div style={{ flex: 1 }}>
        <LoadingAnimation />
      </div>
    </main>
  );
}
