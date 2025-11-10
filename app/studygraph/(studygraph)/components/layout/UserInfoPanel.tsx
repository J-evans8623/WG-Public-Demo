/**
 * @file UserInfoPanel.tsx
 * @description
 *   Production-ready user profile side panel that presents authenticated session details and
 *   subscription status in a single, cohesive view. This component is responsible for rendering
 *   the user’s avatar, name, and email, exposing clear sign-in and sign-out controls, and
 *   surfacing subscription information that is fully aligned with backend billing state. Rather
 *   than relying on mock data, it now integrates directly with the shared `ApiContext` and
 *   `useAccountStatus` hook to consume the authoritative `/api/account/status` payload and the
 *   derived `SubscriptionUiSnapshot`. Using this abstraction, the panel can distinguish between
 *   freemium and premium users, render a human-readable plan label (for example, “Scholar •
 *   Premium • Monthly”), and show either a “Renews on” or “Ends on” date depending on whether
 *   the subscription is set to cancel at period end. All actions are wired into authenticated
 *   flows: subscribing routes users to `/billing/offer`, while managing billing launches the
 *   Stripe Billing Portal via the secure `/api/stripe/portal` endpoint, which itself validates
 *   the NextAuth session using `authenticateRequest`. The component preserves all existing CSS
 *   classes and layout structure, maintains strict WCAG accessibility practices, and performs
 *   only O(1) computations per render by branching on the precomputed subscription phase, making
 *   it safe and efficient for frequent display in the application shell.
 */

"use client";

import React, { useState, useMemo } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import "./UserInfoPanel.css";
import { useAccountStatus } from "@/app/src/context/ApiContext"; 

interface UserInfoPanelProps {
  onClose: () => void;
}

/**
 * @function UserInfoPanel
 * @description
 *   React component that renders the authenticated user’s profile card, subscription status,
 *   and session controls inside a centered modal-style panel. It combines NextAuth session data
 *   with the shared `useAccountStatus` hook to display a normalized view of the user’s billing
 *   state, including plan label and renewal or end date. Based on the derived subscription phase
 *   (UNSUBSCRIBED, ACTIVE, CANCEL_AT_PERIOD_END), it conditionally shows a primary “Subscribe”
 *   CTA, premium-only “Unsubscribe” and “Manage billing” actions, or a sign-in prompt when no
 *   session exists. All network interactions are O(1) and rely on backend endpoints that enforce
 *   authentication, ensuring users must be signed in before subscribing or entering the billing
 *   portal. The component preserves existing styling and accessibility while removing mock data
 *   in favor of real backend-driven subscription information.
 */
export const UserInfoPanel: React.FC<UserInfoPanelProps> = ({ onClose }) => {
  const { data: session, status } = useSession();
  const isSessionLoading = status === "loading";
  const isAuthed = status === "authenticated";

  // update - 2: Real account status + derived subscription snapshot
  const {
    accountStatus,
    isLoading: isAccountLoading,
    subscriptionUi,
  } = useAccountStatus();

  const [isProcessing, setIsProcessing] = useState(false); // shared spinner for actions  // update - 3

  const userName =
    (session?.user?.name || session?.user?.email || "User") ?? "";
  const userEmail = session?.user?.email ?? "";
  const userImage = session?.user?.image ?? "";

  // update - 4: Derive simple booleans from subscription snapshot in O(1).
  const subscriptionFlags = useMemo(() => {
    if (!subscriptionUi) {
      return {
        isSubscribed: false,
        isCanceledAtPeriodEnd: false,
      };
    }

    const isSubscribed =
      subscriptionUi.phase === "ACTIVE" ||
      subscriptionUi.phase === "CANCEL_AT_PERIOD_END";

    const isCanceledAtPeriodEnd =
      subscriptionUi.phase === "CANCEL_AT_PERIOD_END";

    return { isSubscribed, isCanceledAtPeriodEnd };
  }, [subscriptionUi]);

  // update - 5: Format renewal/end date once per render using Stripe-based epoch seconds.
  const formattedRenewalDate = useMemo(() => {
    if (!subscriptionUi?.renewalDate) return null;
    try {
      return subscriptionUi.renewalDate.toLocaleDateString("en-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "America/St_Johns",
      });
    } catch {
      // Fallback without explicit time zone if environment lacks the IANA zone.
      return subscriptionUi.renewalDate.toLocaleDateString("en-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  }, [subscriptionUi]);

  /**
   * @function handleSignIn
   * @description
   *   Starts the Google OAuth sign-in flow using NextAuth, while displaying a processing state
   *   so users receive feedback that authentication is in progress. On success, users are routed
   *   back into the studygraph space; on failure, errors are logged to the console without
   *   disrupting the rest of the panel. Time complexity is O(1), with the heavy lifting handled
   *   by the NextAuth infrastructure and external identity provider.
   */
  const handleSignIn = async () => {
    setIsProcessing(true);
    try {
      await signIn("google", { callbackUrl: "/studygraph" });
    } catch (error) {
      console.error("Sign in error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * @function handleSignOut
   * @description
   *   Signs the user out via NextAuth while toggling a processing state to avoid duplicate clicks.
   *   After sign-out, the user is redirected to the `/signin` page and the panel is closed to
   *   prevent stale UI. This function does not manage any billing state directly; instead, it
   *   defers to the existing authentication flow and allows `ApiContext` to clear cached data.
   */
  const handleSignOut = async () => {
    setIsProcessing(true);
    try {
      await signOut({ callbackUrl: "/signin" });
      onClose();
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * @function handleSubscribe
   * @description
   *   Navigates authenticated users to the `/billing/offer` page where the server-side gated
   *   Stripe checkout flow begins. This function does not talk to Stripe directly; instead, it
   *   relies on the Offers page and the `/api/stripe/checkout` endpoint, both of which enforce
   *   authentication via `authenticateRequest`. If a non-authenticated user somehow triggers this
   *   action, the server path will still enforce sign-in before any subscription is created.
   */
  const handleSubscribe = async () => {
    setIsProcessing(true); // update - 6
    try {
      window.location.assign("/billing/offer"); // update - 6
    } catch (error) {
      console.error("Subscribe navigation error:", error); // update - 6
    } finally {
      setIsProcessing(false); // update - 6
    }
  };

  /**
   * @function handleUnsubscribe
   * @description
   *   Entry point for unsubscribe intent. In this implementation, we direct users into the Stripe
   *   Billing Portal, where cancellation can be performed safely on Stripe’s side without WiseGraph
   *   needing to manage payment methods directly. The same `/api/stripe/portal` endpoint is used
   *   as for general billing management, and it is already protected by `authenticateRequest`, so
   *   only signed-in users can access it. A more specialized unsubscribe endpoint could be wired
   *   here in the future if product requirements evolve.
   */
  const handleUnsubscribe = async () => {
    setIsProcessing(true); // update - 7
    try {
      // For now, treat unsubscribe as “open portal where you can cancel”.
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      if (res.status === 401) {
        window.location.assign("/signin?returnTo=/billing/offer");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data?.url) {
        window.location.assign(data.url);
      }
    } catch (error) {
      console.error("Unsubscribe / portal error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * @function handleManageBilling
   * @description
   *   Launches the Stripe Billing Portal via the authenticated `/api/stripe/portal` BFF endpoint.
   *   The endpoint validates the current NextAuth session using `authenticateRequest`, creates a
   *   portal session for the user’s Stripe customer, and returns a one-time portal URL. On 401
   *   responses, the user is redirected to `/signin` with a return hint so they can resume billing
   *   management after authentication. All heavy lifting remains server-side; time complexity for
   *   this client function is constant.
   */
  const handleManageBilling = async () => {
    setIsProcessing(true); // update - 8
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" }); // same endpoint as before
      if (res.status === 401) {
        window.location.assign("/signin?returnTo=/billing/offer");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data?.url) {
        window.location.assign(data.url);
      }
    } catch (error) {
      console.error("Billing portal error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const showSubscriptionSkeleton = isAccountLoading && isAuthed; // update - 9

  return (
    <div className="user-info-panel">
      <div className="user-info-container">
        {/* Loading state for session resolution */}
        {isSessionLoading && (
          <div className="user-info-card">
            <div className="user-info-loading">
              <div className="user-info-spinner" />
              <p className="user-info-loading-text">Checking your session...</p>
            </div>
          </div>
        )}

        {/* Authenticated state with real subscription data */}
        {!isSessionLoading && isAuthed && (
          <div className="user-info-card">
            {/* Header Section */}
            <div className="user-info-header">
              <div className="user-info-avatar-wrapper">
                {userImage ? (
                  <Image
                    src={userImage}
                    alt="Profile picture"
                    width={72}
                    height={72}
                    className="user-info-avatar"
                  />
                ) : (
                  <div className="user-info-avatar-placeholder">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <h2 className="user-info-name">{userName}</h2>
              {userEmail && <p className="user-info-email">{userEmail}</p>}
            </div>

            {/* Subscription Section */}
            <div className="user-info-section">
              <h3 className="user-info-section-title">Subscription</h3>

              {showSubscriptionSkeleton && (
                <div className="user-info-renewal"> {/* update - 10 */}
                  <p className="user-info-hint">
                    Loading your subscription details…
                  </p>
                </div>
              )}

              {!showSubscriptionSkeleton && (
                <>
                  {subscriptionFlags.isSubscribed ? (
                    <>
                      {/* Subscribed State — premium or cancel-at-period-end */}
                      <div className="user-info-actions">
                        <button
                          onClick={handleUnsubscribe}
                          disabled={isProcessing}
                          className="user-info-btn user-info-btn--danger-outline"
                          aria-label="Unsubscribe from current plan"
                        >
                          {isProcessing ? "Processing..." : "Unsubscribe"}
                        </button>
                        <button
                          onClick={handleManageBilling}
                          disabled={isProcessing}
                          className="user-info-btn user-info-btn--secondary"
                          aria-label="Manage billing information"
                        >
                          {isProcessing ? "Opening portal..." : "Manage billing"}
                        </button>
                      </div>

                      {/* Renewal / Plan Details */}
                      <div className="user-info-renewal">
                        {subscriptionUi?.planLabel && (
                          <div className="user-info-renewal-row">
                            <span className="user-info-renewal-label">
                              Plan
                            </span>
                            <span className="user-info-renewal-value">
                              {subscriptionUi.planLabel}
                            </span>
                          </div>
                        )}

                        {formattedRenewalDate && subscriptionUi?.renewalCopy && (
                          <div className="user-info-renewal-row">
                            <span className="user-info-renewal-label">
                              {subscriptionUi.renewalCopy}
                            </span>
                            <span className="user-info-renewal-value">
                              {formattedRenewalDate}
                            </span>
                          </div>
                        )}

                        {subscriptionFlags.isCanceledAtPeriodEnd && (
                          <div className="user-info-renewal-row">
                            <span className="user-info-renewal-label">
                              Status
                            </span>
                            <span className="user-info-renewal-value">
                              Will end at period close
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Not Subscribed State (freemium) */}
                      <div className="user-info-actions">
                        <button
                          onClick={handleSubscribe}
                          disabled={isProcessing}
                          className="user-info-btn user-info-btn--primary"
                          aria-label="Subscribe to premium plan"
                        >
                          {isProcessing ? "Processing..." : "Subscribe"}
                        </button>
                      </div>
                      <p className="user-info-hint">
                        {subscriptionUi?.planLabel
                          ? `Current: ${subscriptionUi.planLabel}. Upgrade to unlock premium features.`
                          : "Get access to premium features."}
                      </p>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Session Controls */}
            <div className="user-info-section user-info-section--compact">
              <button
                onClick={handleSignOut}
                disabled={isProcessing}
                className="user-info-btn user-info-btn--tertiary"
                aria-label="Sign out of your account"
              >
                {isProcessing ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </div>
        )}

        {/* Unauthenticated state: invite user to sign in */}
        {!isSessionLoading && !isAuthed && (
          <div className="user-info-card">
            <div className="user-info-header">
              <div className="user-info-icon-wrapper">
                <svg
                  className="user-info-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <h2 className="user-info-title">Welcome to Wisegraph</h2>
              <p className="user-info-subtitle">
                Sign in to access your account and premium features.
              </p>
            </div>

            <div className="user-info-section">
              <button
                onClick={handleSignIn}
                disabled={isProcessing}
                className="user-info-btn user-info-btn--google"
                aria-label="Sign in with Google account"
              >
                <svg className="user-info-btn-icon" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                {isProcessing ? "Signing in..." : "Sign in with Google"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserInfoPanel;
