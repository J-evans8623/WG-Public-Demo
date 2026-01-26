// app/(marketing)/welcome/page.tsx

import type { Metadata } from 'next';
import React from 'react';
import WelcomeLandingPage from '@/app/(welcome)/draft/WelcomeLandingPage';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import SoftwareSchema from '@/components/seo/SoftwareSchema';
import VideoSchema from '@/components/seo/VideoSchema';

export const metadata: Metadata = {
  // Keep keywords, but no "Free" promise here seo
  title: 'WiseGraph | Spaced Repetition App & AI Study Planner',
  
  description:
    'Turn your study material into a schedule with lessons, flash cards and quizzes proven to sink what you learn into long term memory.',
    
  // SOCIAL SHARING (Discord/TikTok/Slack)
  openGraph: {
    title: 'WiseGraph | Spaced Repetition App & AI Study Planner',
    // UPDATE: Changed "The free AI tool" to "Try the AI tool"
    description: 'Try the AI tool that plans your studying so you don\'t burn out.',
    images: ['/brand/hero-shot-highest-res.png'],
  },
};

export default function Page(): JSX.Element {
  return (
    <>
      <SoftwareSchema />
      <VideoSchema />
      <SiteHeader />
      <WelcomeLandingPage />
      <SiteFooter />
    </>
  );
}