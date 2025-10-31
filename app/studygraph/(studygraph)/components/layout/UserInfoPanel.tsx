/**
 * @file UserInfoPanel.tsx — Polished & Centered Profile View
 * @description
 *   Completely redesigned user profile panel with centered card layout, subscription
 *   management controls, and renewal details display. Implements warm board brand
 *   styling with professional typography and enhanced accessibility.
 *
 *   Features:
 *   - Centered card layout with avatar, name, and email
 *   - Conditional Subscribe/Unsubscribe button based on subscription status
 *   - Renewal details display (date, plan, price, payment method)
 *   - Sign-in/Sign-out states with Google OAuth integration
 *   - Loading and error states with proper feedback
 *   - Full WCAG accessibility compliance
 */

"use client";

import React, { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import "./UserInfoPanel.css";

interface UserInfoPanelProps {
  onClose: () => void;
}

// Mock subscription data - replace with actual API integration
interface SubscriptionData {
  isSubscribed: boolean;
  renewalDate?: string;
  planName?: string;
  price?: number;
  period?: 'month' | 'year';
  paymentMethod?: string;
}

// Stub function for subscription data - implement with your actual API
const useSubscriptionData = (): SubscriptionData => {
  // TODO: Replace with actual subscription API call
  return {
    isSubscribed: false, // Change to true to test subscribed state
    renewalDate: "2025-11-30",
    planName: "Premium",
    price: 11.99,
    period: "month",
    paymentMethod: "****1234",
  };
};

export const UserInfoPanel: React.FC<UserInfoPanelProps> = ({ onClose }) => {
  const { data: session, status } = useSession();
  const isLoading = status === "loading";
  const isAuthed = status === "authenticated";

  const subscriptionData = useSubscriptionData();
  const [isProcessing, setIsProcessing] = useState(false);

  const userName = (session?.user?.name || session?.user?.email || "User") ?? "";
  const userEmail = session?.user?.email ?? "";
  const userImage = session?.user?.image ?? "";

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

  // Stub functions for subscription management - implement with actual API
  const handleSubscribe = async () => {
    setIsProcessing(true);
    try {
      // TODO: Implement actual subscription flow
      console.log("Subscribe clicked - implement checkout flow");
      // Example: await createCheckoutSession();
    } catch (error) {
      console.error("Subscribe error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnsubscribe = async () => {
    setIsProcessing(true);
    try {
      // TODO: Implement actual unsubscribe flow with confirmation
      console.log("Unsubscribe clicked - implement cancellation flow");
      // Example: await cancelSubscription();
    } catch (error) {
      console.error("Unsubscribe error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      // TODO: Implement billing portal redirect
      console.log("Manage billing clicked - open billing portal");
      // Example: window.location.href = await getBillingPortalUrl();
    } catch (error) {
      console.error("Billing portal error:", error);
    }
  };

  return (
    <div className="user-info-panel">
      <div className="user-info-container">
        {isLoading && (
          <div className="user-info-card">
            <div className="user-info-loading">
              <div className="user-info-spinner" />
              <p className="user-info-loading-text">Checking your session...</p>
            </div>
          </div>
        )}

        {!isLoading && isAuthed && (
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

              {subscriptionData.isSubscribed ? (
                <>
                  {/* Subscribed State */}
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
                      className="user-info-btn user-info-btn--secondary"
                      aria-label="Manage billing information"
                    >
                      Manage billing
                    </button>
                  </div>

                  {/* Renewal Details */}
                  <div className="user-info-renewal">
                    <div className="user-info-renewal-row">
                      <span className="user-info-renewal-label">Renews on</span>
                      <span className="user-info-renewal-value">
                        {new Date(subscriptionData.renewalDate!).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="user-info-renewal-row">
                      <span className="user-info-renewal-label">Plan</span>
                      <span className="user-info-renewal-value">{subscriptionData.planName}</span>
                    </div>
                    <div className="user-info-renewal-row">
                      <span className="user-info-renewal-label">Price</span>
                      <span className="user-info-renewal-value">
                        ${subscriptionData.price?.toFixed(2)}/{subscriptionData.period}
                      </span>
                    </div>
                    <div className="user-info-renewal-row">
                      <span className="user-info-renewal-label">Payment method</span>
                      <span className="user-info-renewal-value">{subscriptionData.paymentMethod}</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Not Subscribed State */}
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
                    Get access to premium features.
                  </p>
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

        {!isLoading && !isAuthed && (
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
              <p className="user-info-subtitle">Sign in to access your account and premium features.</p>
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