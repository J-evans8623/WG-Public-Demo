/**
 * @file SiteHeader.tsx
 * @description The main site navigation header.
 * Includes logo, primary links (Features, Pricing, Blog), and CTA buttons.
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import BrandIcon from '@/public/brand/brand-wordmark-1.svg'; // Ensure this path matches your asset folder
import './site-header.css';

const FLOAT_THRESHOLD = 80;

const SiteHeader = () => {
  const [isFloating, setIsFloating] = useState(false);
  
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // The YouTube video section is our trigger boundary.
    // Once it fully leaves the viewport upward, float the nav.
    const sentinel = document.querySelector('#video');

    if (!sentinel) {
      // Fallback: if the anchor doesn't exist, never float.
      return;
    }

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        // isIntersecting goes false when the element has scrolled out of view.
        // We only want to float when scrolling DOWN (not when it re-enters
        // from below on scroll-up past the hero), so we also check that
        // the element's bottom edge has crossed above the viewport top.
        const scrolledPast = !entry.isIntersecting && entry.boundingClientRect.bottom < 0;
        setIsFloating(scrolledPast);
      },
      {
        // No rootMargin — trigger exactly when #video exits the viewport.
        threshold: 0,
      }
    );

    observerRef.current.observe(sentinel);

    return () => observerRef.current?.disconnect();
  }, []);

  
  return (
    <header className={`wg-nav${isFloating ? ' wg-nav--floating' : ''}`}>
      <div className="wg-nav-inner">
        {/* LEFT: LOGO */}
        <div className="wg-nav-left">
          <Link href="/" aria-label="WiseGraph — Home">
            {/* BrandIcon handles its own dimensions via SVG properties or internal CSS */}
            <BrandIcon />
          </Link>
        </div>

        {/* RIGHT: LINKS & CTA */}
        <nav className="wg-nav-right" aria-label="Primary navigation">
          <Link href="/features" className="wg-nav-link">
            Features
          </Link>
          
          {/* (new update - added blog route link) */}
          <Link href="/blog" className="wg-nav-link">
            Blog
          </Link>
          
          <Link href="/billing/offer" className="wg-nav-link">
            Pricing
          </Link>
          
          <div className="wg-nav-sep" aria-hidden="true"></div>
          
          <Link href="/signin?returnTo=/workspace" className="wg-nav-link">
            Log in
          </Link>
          
          <Link href="/billing/offer" className="wg-nav-cta">
            TRIAL FOR FREE
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default SiteHeader;