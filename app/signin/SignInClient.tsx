"use client";

/***********************************************************************************************
 * @file app/signin/SignInClient.tsx
 * @description
 *   Client-only wrapper for the server-rendered sign-in page. Handles:
 *   - Safe extraction of `returnTo` from the query string (same-origin only).
 *   - Redirect to `returnTo` if already authenticated on /signin.
 *   - Starting the Google sign-in flow via NextAuth `signIn`.
 ***********************************************************************************************/

import React, { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

function getSafeReturnTo(candidate: string | null | undefined): string {
  const FALLBACK = "/workspace";
  if (!candidate) return FALLBACK;
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : undefined;
    if (!origin) return FALLBACK;
    const url = new URL(candidate, origin);
    if (url.origin !== origin) return FALLBACK;
    const safePath = `${url.pathname}${url.search}${url.hash}` || FALLBACK;
    return safePath.startsWith("/") ? safePath : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

interface Props {
  className?: string;
}

const SignInClient: React.FC<Props> = ({ className }) => {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnToParam = searchParams?.get("returnTo");
  const safeReturnTo = useMemo(() => getSafeReturnTo(returnToParam), [returnToParam]);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(safeReturnTo);
    }
  }, [status, router, safeReturnTo]);

  return (
    <button
      className={className}
      onClick={() => signIn("google", { callbackUrl: safeReturnTo })}
      aria-label="Sign in with Google"
    >
      Sign in with Google
    </button>
  );
};

export default SignInClient;
