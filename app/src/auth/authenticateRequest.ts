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
  };
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
    //const userProfile = await UserService.getUserProfile(session.user.email);

    //console.log(`8000 authenticateREquest result from await UserService.getUserProfile(session.user.email)  ${JSON.stringify({userProfile})}`)
    
    //console.log('[authenticateRequest.ts][8004] User profile loaded - Account type:', userProfile.accountType, 'Subscription:', userProfile.subscriptionTier);
    
    // Step 4: Update last active timestamp
    await UserService.updateLastActive(session.user.email);
    
    // Step 5: Return enhanced session with complete user context
    const enhancedSession: EnhancedSession = {
      user: {
        email: session.user.email,
      },
    };
    
    console.log('[authenticateRequest.ts][8005] Enhanced session created successfully');
    return enhancedSession;
    
  } catch (error) {
    console.error('[authenticateRequest.ts][8006] Error during enhanced authentication:', error);
    res.status(500).json({ error: "Internal server error during authentication" });
    return null;
  }
}
