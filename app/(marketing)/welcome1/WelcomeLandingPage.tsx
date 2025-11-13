/**
 * @file app\(marketing)\welcome1\WelcomeLandingPage.tsx
 * @description (new update - landing layout refactor)
 *   Client-side landing page shell for the WiseGraph marketing route.
 *   Renders a warm, two-column hero plus four narrative “scene” sections,
 *   an honesty strip, and a final CTA card. Each scene uses a left copy /
 *   right visual layout, with explicit TODO markers showing where to plug
 *   in hero videos and Lottie animations.
 */

'use client';

import React from 'react'; 
import Link from 'next/link';
import './welcomepage.css';
import BrandIcon from '@/public/brand/brand-wordmark-1.svg'


/**
 * Landing page component for WiseGraph’s marketing welcome route.
 * (new update - landing layout refactor)
 *
 * The layout is intentionally simple:
 * - Fixed top navigation with single dominant CTA.
 * - Hero section: headline + subcopy on the left, app mockup on the right.
 * - Four “scene” sections, each mapping copy to a specific demo visual.
 * - Trust / honesty strip followed by a strong closing CTA card.
 */
export default function WelcomeLandingPage(): JSX.Element {
  return (
    <div className="wg-page">
      {/* Top navigation bar */}
      {/* (new update - landing layout refactor) */}
      <header className="wg-nav">
        <div className="wg-nav-inner">
          <div className="wg-nav-left">
            <Link href="/" aria-label="WiseGraph — Home">
        <BrandIcon/>

         </Link>
          </div>

          <nav className="wg-nav-right" aria-label="Primary navigation">
            <Link href="/features" className="wg-nav-link">
              Features
            </Link>
            <Link href="/pricing" className="wg-nav-link">
              Pricing
            </Link>
            <Link href="/billing/offer" className="wg-nav-cta">
              Start Today
            </Link>
          </nav>
        </div>
      </header>

      <main className="wg-main">
        {/* Hero Section */}
        {/* (new update - landing layout refactor) */}
        <section className="wg-hero" aria-labelledby="hero-heading">
          <div className="wg-hero-inner">
            <div className="wg-hero-text">
              <h1 id="hero-heading" className="wg-hero-heading">
                Unlock Your True Learning Potential
              </h1>
              <p className="wg-hero-subtitle">
                Stay on track all semester long—without last-minute cramming.
                WiseGraph turns chapters into clear maps, your notes into a
                schedule, and your semester into steady progress.
              </p>

              <div className="wg-hero-cta-row">
                <Link
                  href="/signin?returnTo=/studygraph"
                  className="wg-btn wg-btn-primary"
                >
                  Start Free
                </Link>
              </div>

              <p className="wg-hero-reassurance">
                No credit card for free tier. Terms and conditions apply.
              </p>
            </div>

            <div className="wg-hero-visual" aria-hidden="true">
              <div className="wg-hero-frame">
                {/* TODO (new update - landing layout refactor):
                    Replace this placeholder with the hero video or
                    animated concept-map mockup that shows PDF → map. */}
                <div className="wg-hero-split">
                  <div className="wg-hero-panel wg-hero-panel-left">
                    <div className="wg-hero-panel-header" />
                    <div className="wg-hero-panel-body">
                      <span className="wg-hero-panel-title">Chapter 3</span>
                      <div className="wg-hero-lines">
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  </div>
                  <div className="wg-hero-arrow" />
                  <div className="wg-hero-panel wg-hero-panel-right">
                    <ul className="wg-hero-map">
                      <li className="wg-hero-node wg-hero-node-main">Main idea</li>
                      <li className="wg-hero-node">Detail A</li>
                      <li className="wg-hero-node">Detail B</li>
                      <li className="wg-hero-node">Example</li>
                      <li className="wg-hero-node">Review</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Scene 1 – PDF → Concept Map */}
        {/* (new update - landing layout refactor) */}
        <section className="wg-section" aria-labelledby="scene1-heading">
          <div className="wg-section-inner">
            <div className="wg-section-text">
              <p className="wg-section-eyebrow">From messy chapters to clarity</p>
              <h2 id="scene1-heading" className="wg-section-heading">
                Turn any chapter into a clickable concept map
              </h2>
              <p className="wg-section-body">
                Upload a PDF chapter and WiseGraph unfolds it into a visual map of
                bite-size topics. Each node becomes a micro-lesson with notes,
                flashcards, and quizzes—so you can scan your course at a glance
                and jump straight into what matters.
              </p>
            </div>

            <div className="wg-section-visual">
              {/* TODO (new update - landing layout refactor):
                  Integrate Scene 1 demo video (PDF upload → concept map),
                  or embed your video player component here. */}
              <div className="wg-demo-frame">
                <div className="wg-demo-tag">Scene 1 · Concept Map</div>
                <div className="wg-demo-placeholder">
                  <span className="wg-demo-label">PDF → Concept Map demo</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Scene 2 – Planner & Schedule */}
        {/* (new update - landing layout refactor) */}
        <section className="wg-section" aria-labelledby="scene2-heading">
          <div className="wg-section-inner">
            <div className="wg-section-text">
              <p className="wg-section-eyebrow">End the cycle of cramming</p>
              <h2 id="scene2-heading" className="wg-section-heading">
                A study plan that actually keeps you on track
              </h2>
              <p className="wg-section-body">
                Pick your notebooks and WiseGraph auto-builds a schedule that
                spaces lessons and weaves topics together. Instead of guessing
                what to review next, you see today&apos;s blocks laid out for you—
                calm, predictable, and aligned with how memory works.
              </p>
            </div>

            <div className="wg-section-visual">
              {/* TODO (new update - landing layout refactor):
                  Integrate Scene 2 demo video (planner filling with
                  color-coded blocks) inside this frame. */}
              <div className="wg-demo-frame">
                <div className="wg-demo-tag">Scene 2 · Planner</div>
                <div className="wg-demo-placeholder">
                  <span className="wg-demo-label">
                    Weekly planner & spaced blocks demo
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Scene 3 – Learning Science Lottie */}
        {/* (new update - landing layout refactor) */}
        <section className="wg-section wg-section-compact" aria-labelledby="scene3-heading">
          <div className="wg-section-inner">
            <div className="wg-section-text">
              <p className="wg-section-eyebrow">Built on real learning science</p>
              <h2 id="scene3-heading" className="wg-section-heading">
                Spaced repetition and interleaving, baked in
              </h2>
              <p className="wg-section-body">
                WiseGraph quietly spaces and mixes your practice over time, so
                concepts move into long-term memory instead of fading after the
                test. Short, repeated check-ins build confidence without
                burnout—cramming becomes the exception, not the rule.
              </p>
            </div>

            <div className="wg-section-visual">
              {/* TODO (new update - landing layout refactor):
                  Replace this placeholder with the Scene 3 Lottie animation
                  comparing cramming vs retention curves. */}
              <div className="wg-demo-frame wg-demo-frame-compact">
                <div className="wg-demo-tag">Scene 3 · Cramming vs Retention</div>
                <div className="wg-demo-placeholder">
                  <span className="wg-demo-label">
                    Cramming vs retention Lottie slot
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Scene 4 – Collaboration & Forum */}
        {/* (new update - landing layout refactor) */}
        <section className="wg-section" aria-labelledby="scene4-heading">
          <div className="wg-section-inner">
            <div className="wg-section-text">
              <p className="wg-section-eyebrow">You don&apos;t have to study alone</p>
              <h2 id="scene4-heading" className="wg-section-heading">
                Bring your classmates into the same map
              </h2>
              <p className="wg-section-body">
                Invite friends into your notebook to ask questions, swap
                explanations, and keep each other accountable—right next to the
                concepts you&apos;re learning. Threads stay tied to specific nodes,
                so discussions are focused instead of getting lost in a chat
                history.
              </p>
            </div>

            <div className="wg-section-visual">
              {/* TODO (new update - landing layout refactor):
                  Integrate Scene 4 collaboration clip (forum + avatars),
                  or mount your existing forum demo player here. */}
              <div className="wg-demo-frame">
                <div className="wg-demo-tag">Scene 4 · Collaboration</div>
                <div className="wg-demo-placeholder">
                  <span className="wg-demo-label">
                    Shared notebook & forum demo
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* Final CTA Section */}
        {/* (new update - landing layout refactor) */}
        <section className="wg-final-cta" aria-labelledby="final-cta-heading">
          <div className="wg-final-card">
            <h2 id="final-cta-heading" className="wg-final-heading">
              Ready to transform your learning?
            </h2>
            <p className="wg-final-body">
              Cramming isn&apos;t discipline—it&apos;s survival mode. It burns energy,
              kills focus, and leaves you running on empty. Structured learning
              isn&apos;t just efficient—it&apos;s self-care. WiseGraph gives you a system
              that works with your brain, not against it.
            </p>
            <Link href="/billing/offer" className="wg-btn wg-btn-primary wg-btn-large">
              Start Today — Take Back Control of Your Semester
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
