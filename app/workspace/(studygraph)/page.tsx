// File: app/workspace/(studygraph)/page.tsx
// NOTE: This is a SERVER component (no "use client")

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { AppLayout } from './app';

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function StudygraphPage({ searchParams = {} }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    // Rebuild "?..." from the provided searchParams
    const qs = new URLSearchParams();
    for (const [key, val] of Object.entries(searchParams)) {
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

  // Signed in → render the client AppLayout
  return <AppLayout />;
}
