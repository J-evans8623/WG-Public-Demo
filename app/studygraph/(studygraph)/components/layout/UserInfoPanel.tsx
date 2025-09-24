// app/studygraph/(studygraph)/components/layout/UserInfoPanel.tsx
"use client"; // update - 1

/**
 * @file UserInfoPanel.tsx
 * @description
 *   User profile panel that reads authentication state from NextAuth and provides
 *   first-class sign-in and sign-out actions. This replaces the deprecated ApiContext
 *   logic with `useSession`, `signIn`, and `signOut` from next-auth/react.
 *
 *   Behavior:
 *   - If authenticated, shows the user’s basic profile info and a “Sign Out” button.
 *   - If unauthenticated, shows a “Sign In with Google” button.
 *   - Uses a `callbackUrl` on sign-in/sign-out to centralize post-auth navigation.
 *
 *   Notes:
 *   - Requires <SessionProvider> higher in the tree (already present in your layout).
 *   - You may change the callbackUrl to route elsewhere after auth transitions.
 */

import React from "react"; // update - 2
import { useSession, signIn, signOut } from "next-auth/react"; // update - 3
import Image from "next/image";

interface UserInfoPanelProps {
  onClose: () => void;
}

export const UserInfoPanel: React.FC<UserInfoPanelProps> = ({ onClose }) => {
  const { data: session, status } = useSession(); // update - 4
  const isLoading = status === "loading"; // update - 5
  const isAuthed = status === "authenticated"; // update - 6

  const userName =
    (session?.user?.name || session?.user?.email || "Signed user") ?? ""; // update - 7
  const userEmail = session?.user?.email ?? ""; // update - 8
  const userImage = session?.user?.image ?? ""; // update - 9

  const handleSignIn = async () => {
    // Single IdP for now: Google
    await signIn("google", { callbackUrl: "/studygraph" }); // update - 10
  };

  const handleSignOut = async () => {
    // End session and send user to the sign-in screen; adjust as needed.
    await signOut({ callbackUrl: "/signin" }); // update - 11
    // Optionally also close the panel to reset UI state
    onClose(); // update - 12
  };

  return (
    <div className="p-6"> {/* update - 13 */}
      <h2 className="text-2xl font-bold mb-4">User Information</h2> {/* update - 14 */}

      {isLoading && (
        <p className="text-gray-600">Checking your session…</p> // update - 15
      )}

      {!isLoading && isAuthed && (
        <div className="space-y-4"> {/* update - 16 */}
          <div className="flex items-center gap-3"> {/* update - 17 */}
            {userImage ? (
              <Image
                src={userImage}
                alt="User avatar"
                width={40}
                height={40}
                className="h-10 w-10 rounded-full border object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gray-200" />
            )}
            <div>
              <p className="font-medium">{userName}</p>
              {userEmail && (
                <p className="text-sm text-gray-600">{userEmail}</p>
              )}
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
          >
            Sign Out
          </button>
        </div>
      )}

      {!isLoading && !isAuthed && (
        <div className="space-y-4"> {/* update - 18 */}
          <p className="text-gray-700">
            You are not signed in.
          </p>
          <button
            onClick={handleSignIn}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Sign in with Google
          </button>
        </div>
      )}

      <button
        onClick={onClose}
        className="mt-6 text-gray-600 underline hover:text-gray-800 transition"
      >
        Back
      </button>
    </div>
  );
};

export default UserInfoPanel; // update - 19
