/***********************************************************************************************
 * @file page.tsx
 * @description
 *   Client-side Sign-In page for **WiseGraph** that mirrors the provided HTML layout while
 *   integrating NextAuth.js to initiate the Google OAuth flow. Typography is handled with
 *   `next/font` for Inter and Crimson Text. Styles are scoped via styled-jsx to faithfully
 *   reproduce the original design (colors, spacing, focus states), and the brand name has
 *   been updated from “StudyGraph” to “WiseGraph”.
 *
 * Responsibilities:
 *   - Render the WiseGraph wordmark and sign-in UI on a warm background.
 *   - Present a single “Sign in with Google” CTA (current supported option).
 *   - Redirect authenticated users to the intended page (returnTo) or fallback (/studygraph).  // update - 39
 *   - Preserve accessibility affordances (focus outlines, semantic markup).
 *
 * Notes:
 *   - Document title set via <Head> for this client page.
 *   - If you later add more IdPs, place additional buttons beneath the Google button.
 *
 * @author
 * @date
 ***********************************************************************************************/
"use client"; // update - 1

import React, { useEffect, useMemo } from "react"; // update - 2
import Head from "next/head"; // update - 3
import { useRouter, useSearchParams } from "next/navigation"; // update - 40
import { signIn, useSession } from "next-auth/react"; // update - 5
import { Inter, Crimson_Text } from "next/font/google"; // update - 6

// Fonts (served optimally via next/font) — mirrors the original HTML's Inter + Crimson Text.
const inter = Inter({ subsets: ["latin"], weight: ["400"] }); // update - 7
const crimson = Crimson_Text({ subsets: ["latin"], weight: ["400", "600"] }); // update - 8

/**
 * @function getSafeReturnTo
 * @description
 *   Validate a candidate returnTo URL to ensure it is same-origin and path-based. Falls back to
 *   "/studygraph" if invalid or cross-origin. Accepts absolute or relative inputs.
 */
function getSafeReturnTo(candidate: string | null | undefined): string { // update - 41
  const FALLBACK = "/studygraph";
  if (!candidate) return FALLBACK;
  try {
    const origin =
      typeof window !== "undefined" ? window.location.origin : undefined;
    if (!origin) return FALLBACK;

    // Support both absolute and relative values
    const url = new URL(candidate, origin);

    // Enforce same-origin; then return only path+search+hash
    if (url.origin !== origin) return FALLBACK;
    const safePath = `${url.pathname}${url.search}${url.hash}` || FALLBACK;

    // Extra guard: only allow path-style targets
    return safePath.startsWith("/") ? safePath : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

const SignInPage: React.FC = () => {
  const { data: session, status } = useSession(); // update - 9
  const router = useRouter(); // update - 10
  const searchParams = useSearchParams(); // update - 42

  // Derive a safe returnTo from the query string
  const returnToParam = searchParams?.get("returnTo"); // update - 43
  const safeReturnTo = useMemo(() => getSafeReturnTo(returnToParam), [returnToParam]); // update - 44

  // If already authenticated on /signin, immediately go to returnTo (or fallback)
  useEffect(() => {
    if (status === "authenticated") { // update - 45
      router.replace(safeReturnTo); // update - 46
    }
  }, [status, router, safeReturnTo]); // update - 47

  return (
    <>
      {/* Page metadata (title updated to WiseGraph) */}
      <Head>
        <title>WiseGraph - Sign in</title> {/* update - 12 */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" /> {/* update - 13 */}
      </Head>

      {/* Root container; we scope CSS below to this component */}
      <div className="page-root"> {/* update - 14 */}
        <main className="main-content"> {/* update - 15 */}
          <h1 className={`wordmark ${crimson.className}`}>WiseGraph</h1> {/* update - 16 */}
          <p className={`subtitle ${inter.className}`}>Sign in to continue</p> {/* update - 17 */}

          <button
            className={`google-signin-btn ${inter.className}`} // update - 19
            onClick={() =>
              signIn("google", { callbackUrl: safeReturnTo }) // update - 48
            }
            aria-label="Sign in with Google"
          >
            Sign in with Google
          </button>

          <a href="#" className={`school-email-link ${inter.className}`} aria-label="Use school email"> {/* update - 21 */}
            Use school email
          </a>
        </main>

        <footer className="footer"> {/* update - 22 */}
          <a href="#" aria-label="Privacy">Privacy</a> · <a href="#" aria-label="Terms">Terms</a>
        </footer>
      </div>

      <style jsx>{`
        .page-root { /* replaces <body> rules from the HTML */ /* update - 23 */
          background-color: #FFFBEF;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .main-content { /* update - 24 */
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
          max-width: 360px;
          width: 100%;
          padding: 0 1rem;
        }

        .wordmark { /* update - 25 */
          font-size: 3rem;
          font-weight: 600;
          color: #8B0000;
          text-align: center;
        }

        .subtitle { /* update - 26 */
          font-size: 1.125rem;
          color: #2C3E50;
          text-align: center;
          margin-top: -1rem;
        }

        .subtitle.subtle { /* extra fine-tune for the second line */ /* update - 27 */
          margin-top: -1.5rem;
          font-size: 0.9rem;
        }

        .google-signin-btn { /* update - 28 */
          background-color: #6C8EBF;
          color: #ffffff;
          border: none;
          padding: 1rem 2rem;
          font-size: 1rem;
          width: 100%;
          max-width: 320px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        .google-signin-btn:hover { /* update - 29 */
          background-color: #5a7aa8;
        }
        .google-signin-btn:focus { /* update - 30 */
          outline: 2px solid #6C8EBF;
          outline-offset: 2px;
        }

        .school-email-link { /* update - 31 */
          color: #5B8C5A;
          text-decoration: none;
          font-size: 0.9rem;
          margin-top: 0.5rem;
        }
        .school-email-link:hover { /* update - 32 */
          text-decoration: underline;
        }
        .school-email-link:focus { /* update - 33 */
          outline: 2px solid #5B8C5A;
          outline-offset: 2px;
        }

        .footer { /* update - 34 */
          position: fixed;
          bottom: 1rem;
          font-size: 0.75rem;
          color: #666;
        }
        .footer a { /* update - 35 */
          color: #666;
          text-decoration: none;
        }
        .footer a:hover { /* update - 36 */
          text-decoration: underline;
        }
        .footer a:focus { /* update - 37 */
          outline: 2px solid #666;
          outline-offset: 2px;
        }
      `}</style>
    </>
  );
};

export default SignInPage; // update - 38
