// app/features/page.tsx

/**
 * @file app/features/page.tsx
 * @description Features page using the shared SiteHeader and SiteFooter components.
 */

import React from 'react';
import SiteHeader from '@/components/SiteHeader'; 
import GettingStartedContent from './features-page';
// update - 1: Import SiteFooter
import SiteFooter from '@/components/SiteFooter';
import { Metadata } from 'next';


export const metadata: Metadata = {
  title: 'Features - AI Quizzes, Summaries & Collaborative Maps',
  description: 'Explore the toolkit: AI-generated quizzes for active recall, 5-minute micro-lessons, real-time collaborative note-editing, and a dynamic study planner that adapts to your schedule.',
  openGraph: {
    title: 'WiseGraph — Unlock Your True Learning Potential',
    description: 'From collaborative concept maps to automated spaced repetition schedules. See how WiseGraph beats cramming.',
  },
};

export default function FeaturesPage() {
  return (
    <div className="wg-page">
      {/* 1. Use the Shared Component */}
      <SiteHeader />

      {/* 2. Render the Main Content */}
      <main>
        <GettingStartedContent />
      </main>

      {/* update - 2: Add Footer at the bottom of the page wrapper */}
      <SiteFooter />
    </div>
  );
}