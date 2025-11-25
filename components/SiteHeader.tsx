'use client';

import React from 'react';
import Link from 'next/link';
import BrandIcon from '@/public/brand/brand-wordmark-1.svg'; // Adjust path as needed
import './site-header.css';

const SiteHeader = () => {
  return (
    <header className="wg-nav">
      <div className="wg-nav-inner">
        {/* LEFT: LOGO */}
        <div className="wg-nav-left">
          <Link href="/" aria-label="WiseGraph — Home">
            {/* Ensure BrandIcon has dimensions or CSS handles it */}
            <BrandIcon/>
          </Link>
        </div>

        {/* RIGHT: LINKS & CTA */}
        <nav className="wg-nav-right" aria-label="Primary navigation">
          <Link href="/features" className="wg-nav-link">
            Features
          </Link>
          <Link href="billing/offer" className="wg-nav-link">
            Pricing
          </Link>
          <div className="wg-nav-sep" aria-hidden="true"></div>
          <Link href="/signin?returnTo=/workspace" className='wg-nav-link'>
          Log in
          </Link>
          <Link href="/billing/offer" className="wg-nav-cta">
            Start Today
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default SiteHeader;