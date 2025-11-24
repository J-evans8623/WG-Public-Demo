// components/SiteFooter.tsx

'use client';

import React from 'react';
import Link from 'next/link';
import BrandIcon from '@/public/brand/brand-wordmark-1.svg';
import './site-footer.css';

/**
 * @file components/SiteFooter.tsx
 * @description A reusable footer component for all public-facing pages.
 * Displays the brand identity, navigation links, and legal compliance info.
 * * * Structure:
 * - Left Column: Brand Logo + Hero Text
 * - Right Columns: Features Links, Company Links
 * - Bottom Row: Legal Links + Copyright + Incorporation Symbol
 */

const SiteFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="wg-footer" role="contentinfo">
      <div className="wg-footer-inner">
        
        {/* TOP SECTION: Brand + Nav Grid */}
        <div className="wg-footer-top">
          
          {/* 1. Brand Column */}
          <div className="wg-footer-brand-col">
            <Link href="/" className="wg-footer-logo-link" aria-label="WiseGraph Home">
              <BrandIcon/>
            </Link>
            <p className="wg-footer-hero-text">
              Unlock your true learning potential with Wisegraph.
            </p>
          </div>

          {/* 2. Features Column */}
          <nav className="wg-footer-nav-col" aria-label="Footer Features Navigation">
            <h3 className="wg-footer-heading">Features</h3>
            <Link href="/features" className="wg-footer-link">
              How It Works
            </Link>
            <Link href="/billing/offer" className="wg-footer-link">
              Pricing
            </Link>
          </nav>

          {/* 3. Company Column */}
          <nav className="wg-footer-nav-col" aria-label="Footer Company Navigation">
            <h3 className="wg-footer-heading">Company</h3>
            <Link href="/about" className="wg-footer-link">
              About Us
            </Link>
            <Link href="/contact" className="wg-footer-link">
              Contact
            </Link>
          </nav>
        </div>

        {/* BOTTOM SECTION: Legal & Copyright */}
        <div className="wg-footer-bottom">
          <div className="wg-footer-legal-links">
            <Link href="/terms-and-conditions" className="wg-legal-link">
              Terms of Service
            </Link>
            <Link href="/privacy-terms" className="wg-legal-link">
              Privacy
            </Link>
            <Link href="/cookie-preferences" className="wg-legal-link">
              Cookie preferences
            </Link>
          </div>
          
          <div className="wg-copyright">
            <span>Wisegraph Learning Systems Inc.</span>
            <span style={{ marginLeft: '4px' }}>&copy; {currentYear}</span>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default SiteFooter;