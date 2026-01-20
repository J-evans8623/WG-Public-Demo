/**
 * @file api/account/status.ts
 * @description
 * Secure API endpoint that provides comprehensive user account status information including
 * account type, subscription tier, feature flags, and usage limits. This endpoint integrates
 * with the enhanced user profile system to deliver real-time account metadata to the frontend
 * client while maintaining the established BFF security architecture. The endpoint leverages
 * the existing authentication infrastructure and UserService abstraction to provide consistent
 * account data that enables optimistic UI rendering while ensuring all operations remain
 * subject to backend validation. The implementation includes comprehensive error handling,
 * logging for observability, and proper HTTP status codes for different scenarios. The
 * endpoint is designed to be called frequently by the frontend for account status updates
 * without compromising performance or security. Response caching headers are included to
 * optimize performance while ensuring data freshness for critical account changes.
 *
 * Responsibilities:
 *   - Authenticate incoming requests using existing NextAuth infrastructure
 *   - Retrieve comprehensive user profile data via UserService
 *   - Transform user profile data into frontend-consumable format
 *   - Provide feature flags and limits based on account type and subscription
 *   - Handle authentication failures with appropriate HTTP status codes
 *   - Include performance optimizations through response caching
 *   - Maintain comprehensive logging for debugging and monitoring
 *   - Ensure data consistency with existing user management systems
 *
 * @author System
 * @date Current
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import type { BillingSnapshot } from '@/app/src/billing/types';
import { UserService, CampaignStatus } from '@/app/src/services/userService';
import { UserFileMetadata } from '@/app/src/types/fileTypes';
import { firestore } from '@/app/src/services/firebase';

interface AccountStatusResponse {
  email:string,
  accountType: 'scholar' | 'educator';
  subscriptionTier: 'freemium' | 'premium';
  remainingDemoCredits?: number;
  campaignStatus?: CampaignStatus;
  features: {
    canCreatePublicFiles: boolean;
    canInviteEditors: boolean;
    hasAdvancedFeatures: boolean;
  };
  limits: {
    maxCollaborators: number;
    maxDocuments: number;
    maxStorageGB: number;
  };
  billing: BillingSnapshot | null;
  bootstrappedFiles? : UserFileMetadata[],
  reachedMilestones?: string[]; // Wire for Milestone Checkmarks
  premiumUntil?: any;            // Wire for Countdown Logic
}


/**
 * @function handler
 * @description
 * Main request handler that processes account status requests with comprehensive
 * authentication, data retrieval, and response formatting. The handler ensures
 * secure access to user account information while providing optimized response
 * caching for performance. Includes detailed error handling and logging for
 * production observability and debugging support.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AccountStatusResponse | { error: string }>
) {
  // Step 1: Validate HTTP method
  if (req.method !== 'GET') {
    console.log('[api/account/status.ts][2001] Invalid method attempted:', req.method);
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[api/account/status.ts][2002] Account status request received');

  try {
    // Step 2: Authenticate request using existing infrastructure
    const session = await authenticateRequest(req, res);
    if (!session) {
      console.log('[api/account/status.ts][2003] Authentication failed for account status request');
      return; // authenticateRequest already sent 401 response
    }

    console.log('[api/account/status.ts][2004] Authentication successful for user:', session.user.email);

    const userEmail = session.user.email;

    const [userProfile, userUsage] = await Promise.all([
      UserService.getUserProfile(userEmail),
      UserService.getUserUsage(userEmail)
    ]);

    // update - 3: Fetch progress from the application collection (The Source of Truth)
    const appDoc = await firestore.collection('referral_applications').doc(userEmail).get();
    const appData = appDoc.exists ? appDoc.data() : null;

    if (!userProfile) {
      console.error('[api/account/status.ts][2005] User profile not found in session');
      return res.status(500).json({ error: 'User profile not available' });
    }

    // Step 4: Transform user profile data to API response format
    const accountStatus: AccountStatusResponse = {
      email: userProfile.email,
      accountType: userProfile.accountType,
      subscriptionTier: userProfile.subscriptionTier,
      remainingDemoCredits: userUsage.demoCredits?.remaining ?? 0,
      campaignStatus: userProfile.campaignStatus,
      features: userProfile.features,
      limits: userProfile.limits,
      billing: userProfile.billing ?? null,
      bootstrappedFiles : userProfile._bootstrappedFiles,
      reachedMilestones: appData?.reachedMilestones || [],
      premiumUntil:userProfile.premiumUntil && typeof userProfile.premiumUntil.toMillis === 'function' 
        ? userProfile.premiumUntil.toMillis() 
        : userProfile.premiumUntil || null,
    };



    // Step 5: Set caching headers for performance optimization
    // Cache for 5 minutes to balance freshness with performance
    res.setHeader('Cache-Control', 'private, max-age=300, stale-while-revalidate=60');
    
    // Step 6: Send successful response
    res.status(200).json(accountStatus);


  } catch (error) {
    console.error('[api/account/status.ts][2009] Account status request failed:', error);
    
    // Step 7: Handle errors with appropriate response
    if (error instanceof Error) {
      return res.status(500).json({ error: 'Failed to retrieve account status' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}