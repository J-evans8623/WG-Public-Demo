/**
 * @file authenticateRequest.ts (Enhanced)
 * @description
 *   Enhanced authentication utility that integrates with the new user profile system to provide
 *   comprehensive user data alongside session validation. This updated version automatically
 *   retrieves or creates user profiles during authentication, ensuring that all authenticated
 *   requests have access to complete user context including account types, subscription tiers,
 *   and usage tracking. The enhancement maintains backward compatibility with existing code
 *   while extending functionality to support the new user data abstraction system. All user
 *   profile operations follow the safe-default principle where scholar/freemium profiles are
 *   created for new users to ensure maximum security and privacy protection.
 *
 * Responsibilities:
 *   - Validate incoming API requests using NextAuth.js session management
 *   - Automatically retrieve or create user profiles for authenticated users
 *   - Provide enhanced session objects with complete user context
 *   - Support account type detection and permission validation
 *   - Integrate seamlessly with existing authentication workflows
 *   - Maintain proper error handling and security logging
 */

import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../pages/api/auth/[...nextauth]";
import { UserService, UserProfile } from "../services/userService";

// Step 1: Enhanced session interface with user profile data
export interface EnhancedSession {
  user: {
    email: string;
    accountType: string;
  };
  userProfile: UserProfile;
}

/**
 * authenticateRequest
 * @description
 *   Enhanced authentication function that validates sessions and provides complete user context.
 *   This function automatically handles user profile creation for new users and ensures that
 *   all authenticated requests have access to current user data including account types,
 *   subscription tiers, and usage information. The function maintains backward compatibility
 *   while extending functionality to support comprehensive user data management.
 * @param req - The API request object
 * @param res - The API response object
 * @returns Promise resolving to enhanced session with user profile or null if authentication fails
 */
export async function authenticateRequest(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<EnhancedSession | null> {
  console.log('[authenticateRequest.ts][8001] Authenticating request with enhanced user profile support');
  
  try {
    // Step 2: Retrieve base session using NextAuth.js
    const session = await getServerSession(req, res, authOptions);
    
    if (!session || !session.user?.email) {
      console.log('[authenticateRequest.ts][8002] Authentication failed - no valid session');
      res.status(401).json({ error: "Unauthorized: No session found" });
      return null;
    }
    
    console.log('[authenticateRequest.ts][8003] Base session validated for user:', session.user.email);
    
    // Step 3: Retrieve or create user profile
    const userProfile = await UserService.getUserProfile(session.user.email);
    
    console.log('[authenticateRequest.ts][8004] User profile loaded - Account type:', userProfile.accountType, 'Subscription:', userProfile.subscriptionTier);
    
    // Step 4: Update last active timestamp
    await UserService.updateLastActive(session.user.email);
    
    // Step 5: Return enhanced session with complete user context
    const enhancedSession: EnhancedSession = {
      user: {
        email: session.user.email,
        accountType: userProfile.accountType,
      },
      userProfile,
    };
    
    console.log('[authenticateRequest.ts][8005] Enhanced session created successfully');
    return enhancedSession;
    
  } catch (error) {
    console.error('[authenticateRequest.ts][8006] Error during enhanced authentication:', error);
    res.status(500).json({ error: "Internal server error during authentication" });
    return null;
  }
}

/**
 * getUserFromSession
 * @description
 *   Utility function to extract user profile from enhanced session data. This function provides
 *   a clean interface for accessing user data within API endpoints and ensures consistent
 *   handling of user profile information across the application. The function includes proper
 *   type safety and null checking to prevent runtime errors.
 * @param session - Enhanced session object from authenticateRequest
 * @returns User profile data or null if session is invalid
 */
export function getUserFromSession(session: EnhancedSession | null): UserProfile | null {
  if (!session?.userProfile) {
    console.warn('[authenticateRequest.ts][8007] Attempted to get user from invalid session');
    return null;
  }
  
  return session.userProfile;
}

/**
 * requireUserProfile
 * @description
 *   Helper function that ensures a valid user profile exists or throws an error. This function
 *   is useful for API endpoints that must have user context to operate correctly. It provides
 *   consistent error handling and reduces boilerplate code in route handlers.
 * @param session - Enhanced session object from authenticateRequest
 * @returns User profile data (guaranteed to be non-null)
 * @throws Error if session or user profile is invalid
 */
export function requireUserProfile(session: EnhancedSession | null): UserProfile {
  const userProfile = getUserFromSession(session);
  if (!userProfile) {
    throw new Error('Valid user profile required for this operation');
  }
  
  return userProfile;
}