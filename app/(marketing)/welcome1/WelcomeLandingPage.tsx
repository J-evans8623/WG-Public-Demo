'use client';

/**
 * @file app\(marketing)\welcome1\WelcomeLandingPage.tsx
 * @description
 *   WiseGraph marketing welcome page with sticky scroll “scenes”.
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
    // '/demo/calendar-scene-2-opt.mp4'
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
      stageBg: 'linear-gradient(135deg, #fff2e0 0%, #fde9ce 100%)',
      themeColor: '#e27312',
    },
    {
      id: 3,
      eyebrow: 'Built on real learning science',
      heading: 'Spaced repetition and interleaving, baked in',
      body:
        'WiseGraph quietly spaces and mixes your practice over time, so concepts move into long-term memory instead of fading after the test. Short, repeated check-ins build confidence without burnout—cramming becomes the exception, not the rule.',
      videoSrc: '/scene-3/craming-vs-spaced-repetition-scene3.mp4',
      stageBg: 'linear-gradient(135deg, #ffefe5 0%, #fde7d8 100%)',
      themeColor: '#cf3520',
    },
    {
      id: 4,
      eyebrow: "You don't have to study alone",
      heading: 'Bring your classmates into the same map',
      body:
        "Invite friends into your notebook to ask questions, swap explanations, and keep each other accountable—right next to the concepts you're learning. Threads stay tied to specific nodes, so discussions are focused instead of getting lost in a chat history.",
      videoSrc: null,
      stageBg: 'linear-gradient(135deg, #f0fff4 0%, #dcfce7 100%)',
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
        WiseGraph turns chapters into clear maps, your notes into a
        schedule, and your semester into steady progress.
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

        {/* Final CTA Section */}
        <section className="wg-final-cta" aria-labelledby="final-cta-heading">
          <div className="wg-final-card">
            <h2 id="final-cta-heading" className="wg-final-heading">
              Ready to transform your learning?
            </h2>
            <p className="wg-final-body">
              Cramming isnt discipline- its survival mode. It burns energy,
              kills focus, and leaves you running on empty. Structured learning
              isnt just efficient—its self-care. WiseGraph gives you a system
              that works with your brain, not against it.
            </p>
            <a
              href="/billing/offer"
              className="wg-btn wg-btn-primary wg-btn-large"
            >
              Start Today — Take Back Control of Your Semester
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

export default WelcomeLandingPage;
