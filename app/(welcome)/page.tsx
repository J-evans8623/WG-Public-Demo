// app/(marketing)/welcome/page.tsx

import type { Metadata } from 'next';
import React from 'react';
import WelcomeLandingPage from '@/app/(welcome)/WelcomeLandingPage';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import SoftwareSchema from '@/components/seo/SoftwareSchema';

export const metadata: Metadata = {
  // Keep keywords, but no "Free" promise here
  title: 'WiseGraph | Spaced Repetition App & AI Study Planner',
  
  description:
    'Stop cramming and start remembering. WiseGraph is an AI study planner that turns your notes into active recall quizzes and schedules them perfectly to prevent burnout.',
    
  // SOCIAL SHARING (Discord/TikTok/Slack)
  openGraph: {
    title: 'WiseGraph | Stop Cramming, Start Remembering',
    // UPDATE: Changed "The free AI tool" to "Try the AI tool"
    description: 'Try the AI tool that plans your studying so you don\'t burn out.',
    images: ['/brand/hero-shot-highest-res.png'],
  },
};

export default function Page(): JSX.Element {
  return (
    <>
      <SoftwareSchema />
      <SiteHeader />
      <WelcomeLandingPage />
      <SiteFooter />
    </>
  );
}