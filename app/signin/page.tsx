/***********************************************************************************************
 * @file page.tsx
 * @description
 *   Client‑side Sign‑In page that presents the option to sign in via Google only.
 *   This page leverages NextAuth.js client helpers to initiate the OAuth flow. Upon successful
 *   authentication, the user is redirected to the main application (studygraph page).
 *
 * Responsibilities:
 *   - Display the "Sign in with Google" button.
 *   - Trigger the sign‑in flow using NextAuth.js helpers.
 *   - Redirect authenticated users to the studygraph page.
 *
 * @author 
 * @date 
 ***********************************************************************************************/
"use client";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";

const SignInPage: React.FC = () => {
  const { data: session } = useSession();
  const router = useRouter();

  // Redirect authenticated users to the main studygraph page.
  useEffect(() => {
    if (session) {
      router.push("/studygraph");
    }
  }, [session, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <h1 className="text-3xl font-bold mb-8">Sign In</h1>
      <div className="flex flex-col gap-4">
        <button
          onClick={() => signIn("google", { callbackUrl: "/studygraph" })}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default SignInPage;
