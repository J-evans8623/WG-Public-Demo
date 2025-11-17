// WelcomeLandingPage.tsx

'use client';

/**
 * @file app\(marketing)\welcome1\WelcomeLandingPage.tsx
 * @description
 *   WiseGraph marketing welcome page with sticky scroll "scenes".
 *   Hero + Todoist-style scroll section (text scenes left, sticky stage
 *   right) + final CTA.
 */

import React, { useEffect, useRef, useState } from 'react';
import './welcomepage.css';
import './scroll-sections.css';
import BrandIcon from '@/public/brand/brand-wordmark-1.svg';

type SceneConfig = {
  id: number;
  eyebrow: string;
  heading: string;
  body: string;
  videoSrc: string | null;
  stageBg: string;
  themeColor: string;
};

function WelcomeLandingPage(): JSX.Element {
  const [activeScene, setActiveScene] = useState(1);
  const scenesRef = useRef<(HTMLDivElement | null)[]>([]);
  const stickyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observers = scenesRef.current.map((sceneEl, index) => {
      if (!sceneEl) return null;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.4) {
              setActiveScene(index + 1);
            }
          });
        },
        {
          threshold: [0, 0.4, 0.6, 1],
          rootMargin: '-20% 0px -20% 0px',
        }
      );

      observer.observe(sceneEl);
      return observer;
    });

    return () => {
      observers.forEach((obs) => obs?.disconnect());
    };
  }, []);

  // Scene data configuration
  const scenes: SceneConfig[] = [
    {
      id: 1,
      eyebrow: 'From messy chapters to clarity',
      heading: 'Turn any chapter into a clickable concept map',
      body:
        'Upload a PDF chapter and WiseGraph unfolds it into a visual map of bite-size topics. Each node becomes a micro-lesson with notes, flashcards, and quizzes—so you can scan your course at a glance and jump straight into what matters.',
      videoSrc: '/demo/scene1-upload-to-lesson.mp4',
      stageBg: "url('/brand/scene1stage.png')",
      themeColor: '#E34432',
    },
    {
      id: 2,
      eyebrow: 'End the cycle of cramming',
      heading: 'A study plan that actually keeps you on track',
      body:
        "Pick your notebooks and WiseGraph auto-builds a schedule that spaces lessons and weaves topics together. Instead of guessing what to review next, you see today's blocks laid out for you—calm, predictable, and aligned with how memory works.",
      videoSrc: '/demo/calendar-scene-2-opt.mp4',
      stageBg: "url('/brand/scene-2-stage.png')",
      themeColor: '#e27312',
    }, 
    {
      id: 3,
      eyebrow: 'Built on real learning science',
      heading: 'Retention, Not Re-Learning',
      body:
        ' Built-in spacing and interleaving lock concepts into long-term memory, so exams feel like reviews, not rescues.',
      videoSrc: '/scene-3/scene-3-stage.mp4',
      stageBg: 'linear-gradient(135deg, #ffefe5 0%, #fde7d8 100%)',
      themeColor: '#cf3520',
    },
    {
      id: 4,
      eyebrow: "You don't have to study alone",
      heading: 'Stronger Notes, Built Together',
      body:
        "Co-edit notes or flashcards and combine your strengths with your peers. So everyone learns faster together.",
      videoSrc: '/demo/scene-4-16-9-aspect.mp4',
      stageBg:  "url('/brand/scene-4-stage.png')",
      themeColor: '#16a34a',
    },
  ];

  const currentScene = scenes[activeScene - 1];

  return (
    <div className="wg-page">
      {/* Navigation */}
      <header className="wg-nav">
        <div className="wg-nav-inner">
          <div className="wg-nav-left">
            <a href="/" aria-label="WiseGraph — Home">
              <BrandIcon/>
            </a>
          </div>
          <nav className="wg-nav-right" aria-label="Primary navigation">
            <a href="/features" className="wg-nav-link">
              Features
            </a>
            <a href="/pricing" className="wg-nav-link">
              Pricing
            </a>
            <a href="/billing/offer" className="wg-nav-cta">
              Start Today
            </a>
          </nav>
        </div>
      </header>

      <main className="wg-main">
        {/* Hero Section */}
        <section className="wg-hero" aria-labelledby="hero-heading">
          <div className="wg-hero-inner">
            <div className="wg-hero-text">
              <h1 id="hero-heading" className="wg-hero-heading">
                Unlock Your True Learning Potential
              </h1>
              <p className="wg-hero-subtitle">
                Stay on track all semester long—without last-minute cramming.
                WiseGraph turns every study session into lasting mastery.
              </p>
              <div className="wg-hero-cta-row">
                <a
                  href="/signin?returnTo=/studygraph"
                  className="wg-btn wg-btn-primary"
                >
                  Start Free
                </a>
              </div>
              <p className="wg-hero-reassurance">
                No credit card for free tier. Terms and conditions apply.
              </p>
            </div>
            {/* Right side: overlay monitor only */}
            <div className="wg-hero-visual" aria-hidden="true">
              <div className="wg-hero-monitor">
                <div className="wg-hero-monitor-inner">
                  <img
                    src="/brand/hero-shot-highest-res.png"
                    alt=""
                    className="wg-hero-monitor-img"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SCROLL SECTION - Todoist-style sticky pattern */}
        <div className="wg-scroll-section">
          <div className="wg-scroll-container">
            {/* Left: Scrolling text scenes */}
            <div className="wg-scenes-column">
              {scenes.map((scene, idx) => (
                <div
                  key={scene.id}
                  ref={(el) => (scenesRef.current[idx] = el)}
                  className="wg-scene-text-block"
                  data-scene={scene.id}
                  style={
                    {
                      '--scene-theme-color': scene.themeColor,
                    } as React.CSSProperties
                  }
                >
                  <p className="wg-section-eyebrow">{scene.eyebrow}</p>
                  <h2 className="wg-section-heading">{scene.heading}</h2>
                  <p className="wg-section-body">{scene.body}</p>

                  {/* Scene 3: show static illustration under the copy */}
                  {scene.id === 3 && (
                    <img
                      src="/scene-3/scene3.png"
                      alt="Illustration comparing cramming with spaced repetition over several days."
                      className="wg-scene-illustration"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Right: Sticky stage */}
            <div className="wg-sticky-column">
              <div
                ref={stickyRef}
                className="wg-sticky-stage"
                style={{ backgroundImage: currentScene.stageBg }}
              >
                <div className="wg-stage-content">
                  {currentScene.videoSrc ? (
                    <div className="wg-scene-video-shell">
                      <video
                        key={currentScene.id}
                        className="wg-scene-video"
                        src={currentScene.videoSrc}
                        autoPlay
                        muted
                        loop
                        playsInline
                      />
                    </div>
                  ) : (
                    <div className="wg-demo-placeholder">
                      <span className="wg-demo-label">
                        Scene {currentScene.id} Visual
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Final CTA Section - NEW DESIGN */}
        <section className="wg-final-cta" aria-labelledby="final-cta-heading">
          <h2 id="final-cta-heading" className="wg-cta-heading">
            Take Back Control of Your Semester
          </h2>
          <p className="wg-cta-body">
            WiseGraph gives you a system that works with your brain, not against it. Start building lasting mastery today.
          </p>
          <a
            href="/billing/offer"
            className="wg-btn wg-btn-primary wg-btn-cta"
          >
            Start Today
          </a>
          <p className="wg-cta-footer">
            Free demo available • No credit card needed. Terms and conditions apply.
          </p>
        </section>
      </main>
    </div>
  );
}

export default WelcomeLandingPage;