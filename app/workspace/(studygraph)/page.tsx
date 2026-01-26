/**
 * @file app/workspace/(studygraph)/page.tsx
 * @description 
 * This server component handles the workspace route. It is the orchestrator for 
 * dynamic social metadata. In Phase 4, we implement 'generateMetadata' to 
 * satisfy the BFF architecture: instead of importing firebase-admin, it calls 
 * the internal 'share-info' API to get sanitized notebook stats. This data 
 * is used to point social media crawlers to the Dynamic Image Engine. 
 * The main component continues to enforce NextAuth session security, 
 * redirecting unauthenticated users while preserving their document context.
 */

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { AppLayout } from './app';
// update - 1: Import Metadata type for SEO/Social orchestration
import { Metadata } from 'next';

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/**
 * @function generateMetadata
 * @description 
 * update - 2: Dynamic metadata generator following BFF patterns.
 * This function intercepts the 'doc' ID, fetches sanitized stats from our 
 * internal public API, and constructs the Open Graph tags. It points 
 * crawlers to the /api/og engine with the specific notebook data.
 * @param {PageProps} props - The async search parameters from the URL.
 * @returns {Promise<Metadata>} - Sanitized metadata for social previews.
 */
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const docId = params.doc as string;

  // Base fallback metadata
  const defaultMeta: Metadata = {
    title: 'WiseGraph | AI Study Planner',
    openGraph: {
      title: 'WiseGraph | Spaced Repetition App',
      description: 'The AI tool that plans your studying so you don\'t burn out.',
      images: ['/brand/hero-shot-highest-res.png'],
    },
  };

  if (!docId) return defaultMeta;

  try {
    // 1. Fetch sanitized metadata from our public BFF endpoint
    const baseUrl = process.env.FRONTEND_BASE_URL || 'https://wisegraph.app';
    const infoResp = await fetch(`${baseUrl}/api/document/share-info?docId=${docId}`, {
      next: { revalidate: 600 } // Cache the metadata fetch for 10 minutes
    });

    if (!infoResp.ok) return defaultMeta;

    const stats = await infoResp.json();

    // 2. Construct the URL for the Dynamic Image Engine (api/og)
    const ogUrl = new URL(`${baseUrl}/api/og`);
    ogUrl.searchParams.set('title', stats.title);
    ogUrl.searchParams.set('l', stats.lessons.toString());
    ogUrl.searchParams.set('c', stats.cards.toString());
    ogUrl.searchParams.set('q', stats.quizzes.toString());

    // 3. Return the dynamic tags to the crawler
    return {
      title: `${stats.title} | WiseGraph`,
      openGraph: {
        title: stats.title,
        description: `View ${stats.lessons} lessons and ${stats.cards} flashcards on WiseGraph.`,
        images: [{
          url: ogUrl.toString(),
          width: 1200,
          height: 630,
        }],
      },
      twitter: {
        card: 'summary_large_image',
        images: [ogUrl.toString()],
      },
    };
  } catch (error) {
    console.error('[Metadata Orchestration Error]', error);
    return defaultMeta;
  }
}

/**
 * @function StudygraphPage
 * @description 
 * The main workspace route handler. It ensures the user is authenticated 
 * before rendering the client-side AppLayout. Unauthenticated users are 
 * redirected to the sign-in page with a returnTo path.
 */
export default async function StudygraphPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await getServerSession(authOptions);

  if (!session) {
    const qs = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (Array.isArray(val)) {
        val.forEach(v => qs.append(key, v));
      } else if (typeof val === 'string') {
        qs.set(key, val);
      }
    }
    const query = qs.toString();
    const returnTo = `/workspace${query ? `?${query}` : ''}`;

    return redirect(`/signin?returnTo=${encodeURIComponent(returnTo)}`);
  }

  return <AppLayout />;
}