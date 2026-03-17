/**
 * @file app/(marketing)/(landing-pages)/learners/page.tsx
 * @description
 * Route entry point for the lifetime learner landing page.
 */

import type { Metadata } from 'next';
import React from 'react';
import SelfLearnerLandingPage from '@/app/(marketing)/(landing-pages)/learners/SelfLearnerLandingPage';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import SoftwareSchema from '@/components/seo/SoftwareSchema';
import VideoSchema from '@/components/seo/VideoSchema';

export const metadata: Metadata = {
  title: 'WiseGraph | Spaced Repetition App & AI Study Planner',
  description:
    'Turn your study material into a schedule with lessons, flash cards and quizzes proven to sink what you learn into long term memory.',
  openGraph: {
    title: 'WiseGraph | Spaced Repetition App & AI Study Planner',
    description: "Try the AI tool that plans your studying so you don't burn out.",
    images: ['/brand/hero-shot-highest-res.png'],
  },
};

export default function LearnersPage(): JSX.Element {
  return (
    <>
      <SoftwareSchema />
      <VideoSchema />
      <SiteHeader />
      <SelfLearnerLandingPage audience="learners" />
      <SiteFooter />
    </>
  );
}