/**
 * AuthContext.ts
 *
 * Provides a React Context to manage authentication state and functions.
 * Responsibilities:
 * - Manage the authentication state of the user.
 * - Provide functions for signing in, signing out, and checking authentication status.
 * - Store user-related data (e.g., email, accountType, accessToken).
 * Dependencies:
 * - React for Context and state management.
 */

import { createContext, useContext } from 'react';

// Define the type for user data
export interface User {
  email: string;
  accountType: 'free' | 'premium';
  accessToken: string;
}

// Define the interface for AuthContext
export interface AuthContextInterface {
  user: User | null; // Current authenticated user or null if unauthenticated
  isAuthenticated: boolean; // Indicates if the user is authenticated
  signIn: (token: string) => Promise<void>; // Handles user sign-in
  signOut: () => void; // Handles user sign-out
  refreshToken: () => Promise<void>; // Refreshes the user's access token
}

// Create the Context
export const AuthContext = createContext<AuthContextInterface | null>(null);

// Hook for easy access to the context
export const useAuthContext = (): AuthContextInterface => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
