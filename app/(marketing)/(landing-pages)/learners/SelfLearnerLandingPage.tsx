'use client';

/**
 * @file app/(marketing)/(landing-pages)/learners/SelfLearnerLandingPage.tsx
 * @description
 * WiseGraph marketing welcome page for the lifetime learner audience.
 */

import React, { useEffect, useRef, useState } from 'react';
import '@/app/(welcome)/draft/welcomepage.css';
import '@/app/(welcome)/scroll-sections.css';
import Image from 'next/image';
import SeeMoreArrow from '@/public/brand/doodle-arrow-pointer.svg';
import { useSearchParams } from 'next/navigation';
import TruthCards from '../../../(welcome)/draft/truth-card/selfLearnerTuthCards';
import VideoHeroShot from '@/app/(welcome)/draft/landingPageB/selfLearnerVideoShot';
import SchoolBanner from '@/app/(welcome)/draft/landingPageB/SchoolBanner';
import AudienceSelector from '@/app/(marketing)/_components/AudienceSelector';
import type { AudienceType } from '@/app/marketing.config';

type SceneConfig = {
  id: number;
  eyebrow: string;
  heading: string;
  body: string;
  videoSrc: string | null;
  stageBg: string;
  themeColor: string;
};

type SelfLearnerLandingPageProps = {
  audience: AudienceType;
};

function SelfLearnerLandingPage({
  audience,
}: SelfLearnerLandingPageProps): JSX.Element {
  const [activeScene, setActiveScene] = useState(1);
  const scenesRef = useRef<(HTMLDivElement | null)[]>([]);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const gclid = searchParams?.get('gclid');

    if (gclid) {
      try {
        localStorage.setItem(
          'wisegraph_ad_context',
          JSON.stringify({
            gclid,
            timestamp: Date.now(),
          }),
        );
      } catch (err) {
        console.warn('Failed to save ad context:', err);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const isMobile = window.innerWidth <= 960;

    const observerOptions = {
      threshold: isMobile ? [0, 0.15, 0.3, 0.5, 0.7, 1] : [0, 0.3, 0.6, 1],
      rootMargin: isMobile ? '-5% 0px -5% 0px' : '-10% 0px -10% 0px',
    };

    const observers = scenesRef.current.map((sceneEl, index) => {
      if (!sceneEl) return null;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const activationThreshold = isMobile ? 0.15 : 0.3;

            if (entry.isIntersecting && entry.intersectionRatio > activationThreshold) {
              setActiveScene(index + 1);
            }
          });
        },
        observerOptions,
      );

      observer.observe(sceneEl);
      return observer;
    });

    if (window.scrollY < 100) {
      setActiveScene(1);
    }

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
        'Upload your chapters and WiseGraph turns it into a visual map of bite-size topics. Each node becomes a five minute micro-lesson with notes, flashcards, and quizzes—so you can scan each chapter at a glance and jump straight into what matters.',
      videoSrc: '/demo/scene1-upload-to-lesson.mp4',
      stageBg: "url('/brand/scene1stage.png')",
      themeColor: '#E34432',
    },
    {
      id: 2,
      eyebrow: 'Stop letting your book list collect dust',
      heading: 'A study plan that fits your life',
      body:
        'Each time you upload a chapter, WiseGraph turns it into focused study sessions you can fit into your week. With guided lessons, flashcards, and quizzes always ready to go, it becomes easier to keep learning even when life gets busy.',
      videoSrc: '/demo/self-learner-studyplanner-feat-shot-trimmed.webm',
      stageBg: "url('/brand/scene-2-stage.png')",
      themeColor: '#e27312',
    },
    {
      id: 3,
      eyebrow: 'Don’t let powerful ideas fade after one read',
      heading: 'Turn insights into long-term memory',
      body:
        ' WiseGraph uses spacing and interleaving to drive core insights deep enough to last, so the lessons you study keep shaping your thinking in the real world.',
      videoSrc: null,
      stageBg: 'linear-gradient(135deg, #ffefe5 0%, #fde7d8 100%)',
      themeColor: '#cf3520',
    },
    {
      id: 4,
      eyebrow: 'Go beyond highlights and forgotten notes',
      heading: 'Journal the inights that transformed your mind',
      body:
        ' As you move through lessons, capture the ideas that surprised you, clarified something, or changed how you see the world.',
      videoSrc: '/demo/annotate-insights-scene-4-16-9.webm',
      stageBg: "url('/brand/scene-4-stage.png')",
      themeColor: '#16a34a',
    },
  ];

  const currentScene = scenes[activeScene - 1];

  return (
    <div className="wg-page">
      <main className="wg-main">
        <section className="wg-hero" aria-labelledby="hero-heading">
          <div className="wg-hero-inner">
            <div className="wg-hero-text">
              <h1 id="hero-heading" className="wg-cta-heading">
                Unlock Your True Learning Potential
              </h1>

              <p className="wg-hero-subtitle">
                Break any book into bite-sized study sessions that fit your life. Wisegraph turns
                each session into lasting mastery
              </p>

              <AudienceSelector activeAudience={audience} />

              <div className="wg-hero-cta-row">
                <a href="/billing/offer" className="wg-btn wg-btn-primary">
                  TRIAL FOR FREE
                </a>
              </div>
            </div>

            <div className="wg-hero-visual" aria-hidden="true">
              <VideoHeroShot />
            </div>
          </div>
        </section>

        <SchoolBanner />
        <div data-nav-float-trigger aria-hidden="true" />

        <div className="wg-scroll-section">
          <div
            className={`wg-scroll-container ${
              activeScene === 3 ? 'wg-scroll-container--scene3' : ''
            }`}
          >
            <div className="wg-scenes-column">
              {scenes.map((scene, idx) => {
                const isScene3 = scene.id === 3;

                return (
                  <React.Fragment key={scene.id}>
                    <div
                      ref={(el) => {
                        scenesRef.current[idx] = el;
                      }}
                      className={`wg-scene-text-block ${
                        isScene3 ? 'wg-scene-text-block--retention' : ''
                      }`}
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

                      {isScene3 ? (
                        <div
                          className="wg-retention-panel"
                          role="group"
                          aria-label="Spaced repetition planner cycle"
                        >
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
                            Spacing and interleaving boost long term memory retention 2-3x vs
                            cramming .
                            <span className="wg-retention-quote-mark">”</span>
                            <span className="wg-retention-quote-cite">
                              {' '}
                              — Rhodes, Cleary &amp; DeLosh (2020)
                            </span>
                          </p>
                        </div>
                      ) : null}
                    </div>

                    {!isScene3 ? (
                      <div className="wg-scene-inline-stage">
                        <div className="wg-sticky-stage" style={{ backgroundImage: scene.stageBg }}>
                          <div className="wg-stage-content">
                            {scene.videoSrc ? (
                              <div className="wg-scene-video-shell">
                                <video
                                  className="wg-scene-video"
                                  src={scene.videoSrc}
                                  autoPlay
                                  muted
                                  loop
                                  playsInline
                                />
                              </div>
                            ) : (
                              <div className="wg-demo-placeholder">
                                <span className="wg-demo-label">Scene {scene.id} Visual</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </div>

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
                      <span className="wg-demo-label">Scene {currentScene.id} Visual</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <TruthCards />
        </div>

        <section className="wg-final-cta" aria-labelledby="final-cta-heading">
          
          <h2 id="final-cta-heading" className="wg-cta-heading">
            Start building a learning habit that lasts
          </h2>
          <p className="wg-cta-body">
           Make the books you study count long after the final page.
          </p>
          <a href="/billing/offer" className="wg-btn wg-btn-primary wg-btn-cta">
            TRIAL FOR FREE
          </a>
        </section>
      </main>
    </div>
  );
}

export default SelfLearnerLandingPage;