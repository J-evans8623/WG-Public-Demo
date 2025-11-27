// /app/layout.tsx
import React from 'react';
import { Metadata } from 'next';
import Head from 'next/head';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import Providers from "./AuthProvider"; 
import '@/app/globals.css';
import '@/app/workspace/(studygraph)/components/layout/CardDisplay/Cards/slideshow.css'

const baseUrl = new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://wisegraph.app');

// 2. The Launch Day SEO Metadata Object
export const metadata: Metadata = {
  metadataBase: baseUrl,
  title: {
    // Template: "Page Name | WiseGraph - AI Study Planner & Concept Map"
    template: '%s | WiseGraph - AI Study Planner & Concept Map',
    default: 'WiseGraph - Unlock Your True Learning Potential',
  },
  description: ' WiseGraph turns your notes into clear concept maps packed with 5-minute micro-lessons, and generates AI quizzes so you never have to cram again.',
  applicationName: 'WiseGraph',
  keywords: [
    'spaced repetition',
    'interleaved practice',
    'concept map',
    'study planner',
    'AI study tool',
    'visual learning',
    'micro-learning',
    'collaborative notes',
    'AI quizzes',
    'medical school study',
    'STEM study tool'
  ],
  authors: [{ name: 'WiseGraph Learning Systems Inc.' }],
  generator: 'Next.js',
  referrer: 'origin-when-cross-origin',
  themeColor: '#ffffff',
  creator: 'WiseGraph Learning Systems Inc.',
  publisher: 'WiseGraph Learning Systems Inc.',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'WiseGraph - Master Any Subject ',
    description: 'Stop cramming. Use spaced repetition for lasting mastery. Turn chapters into 5-minute AI micro-lessons and collaborative concept maps.',
    url: 'https://wisegraph.app',
    siteName: 'WiseGraph',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WiseGraph - Visual Spaced Repetition',
    description: 'Stop cramming. Use spaced repitition to build lasting mastery.',
    creator: '@wisegraphapp',
  },
  alternates: {
    canonical: '/',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  return (
    <html lang="en">
      <Head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf_viewer.min.css"
        />
      </Head>
      <body className="h-screen w-screen overflow-x-hidden bg-[#FFFBEF]">
       <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
