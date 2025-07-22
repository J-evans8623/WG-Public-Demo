// File: app/studygraph/layout.tsx

import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'  // wherever your NextAuth options live

/**
 * @file layout.tsx
 * @description
 * Server-side guard for /studygraph. If there's no active NextAuth session,
 * we immediately redirect the user to the sign-in page.
 */
export default async function StudygraphLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    // not signed in → kick over to your client-side signin page
    return redirect('/signin')
  }

  // signed in → render your AppLayout (or children directly)
  return <>{children}</>
}
