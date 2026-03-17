/**
 * @file components/SiteHeader.tsx
 * @description
 * The main site navigation header.
 *
 * Responsibilities:
 *  1. Renders the brand wordmark, primary links, audience navigation, log-in link, and primary CTA.
 *  2. Floats after the user scrolls past the video section trigger.
 *  3. Preserves the original desktop navigation layout.
 *  4. Adds a mobile-only hamburger menu so hidden links remain accessible on small screens.
 *  5. Uses a dedicated mobile brand mark on small screens while preserving the original desktop mark.
 *  6. Exposes a desktop "Who It's For" dropdown for audience landing pages.
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import BrandIcon from '@/public/brand/brand-wordmark-1.svg';
import MobileBrandIcon from '@/public/brand/brand-work-mark-mobile.svg';
import {
  AUDIENCE_LABELS,
  AUDIENCE_ROUTES,
  type AudienceType,
} from '@/app/marketing.config';
import './site-header.css';

function MenuIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="wg-nav-menu-icon"
      focusable="false"
    >
      <path
        d="M4 7h16M4 12h16M4 17h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="wg-nav-menu-icon"
      focusable="false"
    >
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDownIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="wg-nav-dropdown-icon"
      focusable="false"
    >
      <path
        d="M5.5 7.5L10 12l4.5-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const AUDIENCE_ORDER: AudienceType[] = ['students', 'learners', 'educators'];
const AUDIENCE_MENU_CLOSE_DELAY_MS = 140;

const SiteHeader = (): JSX.Element => {
  const [isFloating, setIsFloating] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAudienceMenuOpen, setIsAudienceMenuOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const audienceMenuRef = useRef<HTMLDivElement | null>(null);
  const audienceMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sentinel = document.querySelector('[data-nav-float-trigger]');

    if (!sentinel) {
      return;
    }

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        const scrolledPast = !entry.isIntersecting && entry.boundingClientRect.bottom < 0;
        setIsFloating(scrolledPast);
      },
      {
        threshold: 0,
      },
    );

    observerRef.current.observe(sentinel);

    return () => observerRef.current?.disconnect();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 640) {
        setIsMobileMenuOpen(false);
      }

      if (window.innerWidth <= 640) {
        setIsAudienceMenuOpen(false);
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;

      if (
        isMobileMenuOpen &&
        headerRef.current &&
        target &&
        !headerRef.current.contains(target)
      ) {
        setIsMobileMenuOpen(false);
      }

      if (
        isAudienceMenuOpen &&
        audienceMenuRef.current &&
        target &&
        !audienceMenuRef.current.contains(target)
      ) {
        setIsAudienceMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
        setIsAudienceMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen, isAudienceMenuOpen]);

  useEffect(() => {
    return () => {
      if (audienceMenuCloseTimerRef.current) {
        clearTimeout(audienceMenuCloseTimerRef.current);
      }
    };
  }, []);

  const clearAudienceMenuCloseTimer = () => {
    if (audienceMenuCloseTimerRef.current) {
      clearTimeout(audienceMenuCloseTimerRef.current);
      audienceMenuCloseTimerRef.current = null;
    }
  };

  const openAudienceMenu = () => {
    clearAudienceMenuCloseTimer();
    setIsAudienceMenuOpen(true);
  };

  const scheduleAudienceMenuClose = () => {
    clearAudienceMenuCloseTimer();
    audienceMenuCloseTimerRef.current = setTimeout(() => {
      setIsAudienceMenuOpen(false);
      audienceMenuCloseTimerRef.current = null;
    }, AUDIENCE_MENU_CLOSE_DELAY_MS);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const closeAllMenus = () => {
    clearAudienceMenuCloseTimer();
    setIsMobileMenuOpen(false);
    setIsAudienceMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const toggleAudienceMenu = () => {
    clearAudienceMenuCloseTimer();
    setIsAudienceMenuOpen((prev) => !prev);
  };

  return (
    <header
      ref={headerRef}
      className={`wg-nav${isFloating ? ' wg-nav--floating' : ''}${
        isMobileMenuOpen ? ' wg-nav--menu-open' : ''
      }`}
    >
      <div className="wg-nav-inner">
        <div className="wg-nav-left">
          <Link href="/" aria-label="WiseGraph — Home" onClick={closeAllMenus}>
            <span className="wg-nav-brand wg-nav-brand--desktop" aria-hidden="true">
              <BrandIcon />
            </span>

            <span className="wg-nav-brand wg-nav-brand--mobile" aria-hidden="true">
              <MobileBrandIcon />
            </span>
          </Link>
        </div>

        <nav className="wg-nav-right" aria-label="Primary navigation">
          <div
            ref={audienceMenuRef}
            className={`wg-nav-dropdown${isAudienceMenuOpen ? ' wg-nav-dropdown--open' : ''}`}
            onMouseEnter={openAudienceMenu}
            onMouseLeave={scheduleAudienceMenuClose}
          >
            <button
              type="button"
              className="wg-nav-link wg-nav-dropdown-trigger"
              aria-haspopup="menu"
              aria-expanded={isAudienceMenuOpen}
              aria-controls="wg-nav-audience-menu"
              onClick={toggleAudienceMenu}
            >
              <span>Who It&apos;s For</span>
              <ChevronDownIcon />
            </button>

            <div
              id="wg-nav-audience-menu"
              className="wg-nav-dropdown-menu"
              role="menu"
              aria-label="Audience pages"
              onMouseEnter={openAudienceMenu}
              onMouseLeave={scheduleAudienceMenuClose}
            >
              {AUDIENCE_ORDER.map((audience) => (
                <Link
                  key={audience}
                  href={AUDIENCE_ROUTES[audience]}
                  className="wg-nav-dropdown-link"
                  role="menuitem"
                  onClick={() => {
                    clearAudienceMenuCloseTimer();
                    setIsAudienceMenuOpen(false);
                  }}
                >
                  <span className="wg-nav-dropdown-title">{AUDIENCE_LABELS[audience]}</span>
                </Link>
              ))}
            </div>
          </div>

          <Link href="/features" className="wg-nav-link">
            Features
          </Link>

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

          <button
            type="button"
            className="wg-nav-menu-toggle"
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="wg-mobile-nav-panel"
            onClick={toggleMobileMenu}
          >
            {isMobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </nav>
      </div>

      <div
        id="wg-mobile-nav-panel"
        className={`wg-mobile-nav-panel${isMobileMenuOpen ? ' wg-mobile-nav-panel--open' : ''}`}
        aria-hidden={!isMobileMenuOpen}
      >
        <div className="wg-mobile-nav-group" aria-label="Audience pages">
          <div className="wg-mobile-nav-group-label">Who It&apos;s For</div>

          {AUDIENCE_ORDER.map((audience) => (
            <Link
              key={audience}
              href={AUDIENCE_ROUTES[audience]}
              className="wg-mobile-nav-link"
              onClick={closeMobileMenu}
            >
              {AUDIENCE_LABELS[audience]}
            </Link>
          ))}
        </div>

        <div className="wg-mobile-nav-group-sep" aria-hidden="true"></div>

        <Link href="/features" className="wg-mobile-nav-link" onClick={closeMobileMenu}>
          Features
        </Link>

        <Link href="/blog" className="wg-mobile-nav-link" onClick={closeMobileMenu}>
          Blog
        </Link>

        <Link href="/billing/offer" className="wg-mobile-nav-link" onClick={closeMobileMenu}>
          Pricing
        </Link>

        <Link
          href="/signin?returnTo=/workspace"
          className="wg-mobile-nav-link"
          onClick={closeMobileMenu}
        >
          Log in
        </Link>
      </div>
    </header>
  );
};

export default SiteHeader;