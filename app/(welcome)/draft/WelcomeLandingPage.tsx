'use client';

/**
 * @file app\(marketing)\welcome1\WelcomeLandingPage.tsx
 * @description
 * WiseGraph marketing welcome page. Features:
 * 1. Visual Hero (Text Left / Monitor Right)
 * 2. Video Showcase (Embedded below hero)
 * 3. Scrollytelling Sections (Sticky video on desktop, inline on mobile)
 */

import React, { useEffect, useRef, useState } from 'react';
import './welcomepage.css';
import '../scroll-sections.css';
import Image from 'next/image';
import SeeMoreArrow from '@/public/brand/doodle-arrow-pointer.svg'; 
import { useSearchParams } from 'next/navigation';

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

  // google ad conversion tracking
  const searchParams = useSearchParams();

  // u Capture and Persist GCLID Logic
  useEffect(() => {
    // 1. Extract the 'gclid' parameter from the current URL
    const gclid = searchParams?.get('gclid');

    // 2. If present, persist to localStorage for retrieval on the success page
    if (gclid) {
      try {
        localStorage.setItem('wisegraph_ad_context', JSON.stringify({ 
          gclid, 
          timestamp: Date.now() 
        }));
      } catch (err) {
        console.warn('Failed to save ad context:', err);
      }
    }
  }, [searchParams]);

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

  const scenes: SceneConfig[] = [
    {
      id: 1,
      eyebrow: 'Stop getting lost in long chapters',
      heading: 'Turn any chapter into a clear roadmap',
      body:
        'Upload your chapters and WiseGraph unfolds it into a visual map of bite-size topics. Each node becomes a five minute micro-lesson with notes, flashcards, and quizzes—so you can scan your course at a glance and jump straight into what matters.',
      videoSrc: '/demo/scene1-upload-to-lesson.mp4',
      stageBg: "url('/brand/scene1stage.png')",
      themeColor: '#E34432',
    },
    {
      id: 2,
      eyebrow: 'End the cycle of procrastination and cramming',
      heading: 'A study plan that keeps you on track',
      body:
        "Each time you upload your course notes, WiseGraph builds and updates your study plan by spacing lessons and weaving topics together. Your study plan will always be ready to use whenever you are ready to jump back in.",
      videoSrc: '/demo/calendar-scene-2-opt.mp4',
      stageBg: "url('/brand/scene-2-stage.png')",
      themeColor: '#e27312',
    }, 
    {
      id: 3,
      eyebrow: 'Built on real learning science',
      heading: 'Retention, Not Re-Learning',
      body:
        ' Wisegraph uses spacing and interleaving to lock concepts into long-term memory, so exams feel like reviews, not rescues.',
      videoSrc:null,
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

      <main className="wg-main">
        {/* =========================================
            1. HERO SECTION (Restored Original Design)
            ========================================= */}
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
                  href="/billing/offer"
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
                  <Image
                    src="/brand/hero-shot-highest-res.png"
                    width={1920} 
                    height={1080}
                    alt="Dashboard preview"
                    className="wg-hero-monitor-img"
                    style={{
                      width: '100%',
                      height: 'auto',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================
            2. VIDEO SHOWCASE (New Addition)
            ========================================= */}
        <section className="wg-video-showcase" id="video" aria-labelledby="video-label">
          <div className="wg-video-showcase-inner">
             
            <div className="wg-video-pointer-wrapper">
              <span id="video-label" className="wg-video-pointer-label">
                See how it works
              </span>
              <SeeMoreArrow className="wg-video-pointer-arrow" />
            </div>

            <div className="wg-video-container">
              <div className="wg-video-wrapper">
                <iframe
                  src="https://www.youtube.com/embed/EX8m4dnDy0I?modestbranding=1&rel=0"
                  title="WiseGraph Demo - How It Works"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>

            <div className="wg-video-caption">
            </div>
          </div>
        </section>

        {/* =========================================
            3. SCROLLYTELLING SECTION
            ========================================= */}
        <div className="wg-scroll-section">
          <div className={`wg-scroll-container ${activeScene === 3 ? 'wg-scroll-container--scene3' : ''}`}>
  {/* Left column: Text + Inline Mobile Videos */}
  <div className="wg-scenes-column">
    {scenes.map((scene, idx) => {
      const isScene3 = scene.id === 3;
      const isScene3Active = isScene3 && activeScene === 3;


      return (
        <React.Fragment key={scene.id}>
          <div
            ref={(el) => {
              scenesRef.current[idx] = el;
            }}
            className={`wg-scene-text-block ${isScene3Active? 'wg-scene-text-block--retention' : ''}`}
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

            {/* Scene 3: show a single centered planner graphic (no stacked visuals) */}
            {isScene3Active && (
              <div className="wg-retention-panel" role="group" aria-label="Spaced repetition planner cycle">
                <div className="wg-retention-image-shell">
                  <Image
                    src="/brand/spaced-repetition-planner.webp"
                    width={3585}
                    height={1185}
                    alt="A three-step study planner cycle: Day 1 new lesson, Day 2 active recall, and interleaved review every three days, with a calendar strip showing repetition."
                    className="wg-retention-image"
                    sizes="(max-width: 960px) 100vw, 1100px"
                  />
                </div>

                <p className="wg-retention-quote">
                  <span className="wg-retention-quote-mark">“</span>
                  Spacing and interleaving boost long term memory retention 2-3x vs cramming .
                  <span className="wg-retention-quote-mark">”</span>
                  <span className="wg-retention-quote-cite"> — Rhodes, Cleary &amp; DeLosh (2020)</span>
                </p>
              </div>
            )}
          </div>

          {/* Inline video stage for mobile devices (hidden on desktop via CSS)
              Scene 3 has NO inline stage because it already renders the centered image above */}
          {!isScene3 && (
            <div className="wg-scene-inline-stage">
              <div className="wg-sticky-stage" style={{ backgroundImage: scene.stageBg }}>
                <div className="wg-stage-content">
                  {scene.videoSrc ? (
                    <div className="wg-scene-video-shell">
                      <video className="wg-scene-video" src={scene.videoSrc} autoPlay muted loop playsInline />
                    </div>
                  ) : (
                    <div className="wg-demo-placeholder">
                      <span className="wg-demo-label">Scene {scene.id} Visual</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </React.Fragment>
      );
    })}
  </div>

  {/* Right column: Desktop sticky video (hidden on mobile via CSS)
      Scene 3 hides this column entirely so it becomes a single centered section */}
  <div className="wg-sticky-column">
    <div ref={stickyRef} className="wg-sticky-stage" style={{ backgroundImage: currentScene.stageBg }}>
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
            <span className="wg-demo-label">Scene {currentScene.id} Visual</span>
          </div>
        )}
      </div>
    </div>
  </div>
</div>

        </div>

        {/* Final CTA Section */}
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