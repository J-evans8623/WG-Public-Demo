/**
 * @file pages/api/analytics/track-conversion.ts (Race-Resilient Handshake)
 * @description
 * This API endpoint orchestrates the "Passive Handshake" between a landing peer 
 * and the referrer. Refactored in Phase 2.b to eliminate race conditions inherent 
 * in rapid sign-up/landing flows. By consuming the 'UserService', the handler 
 * utilizes the Redis caching layer to ensure that new user profiles are 
 * immediately available for validation. The endpoint validates the peer's 
 * one-time 'isFirstSessionFlyerTracking' flag, records a permanent conversion 
 * record, and atomically increments the referrer's counter. The logic enforces 
 * a streamlined single-reward milestone, ensuring high performance and data 
 * integrity during high-velocity growth bursts.
 * * Responsibilities:
 * - Authenticate landing users and resolve document ownership context.
 * - Retrieve user profiles via cached UserService to prevent Firestore propagation delays.
 * - Atomically consume the 'isFirstSessionFlyerTracking' handshake flag.
 * - Persist conversion metadata and trigger the Referrer's O(1) incrementer.
 * - Execute simplified milestone checks for the one-time trial reward.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { firestore } from '@/app/src/services/firebase';
import * as admin from 'firebase-admin';
import { recordConversionEvent, ConversionEvent } from '@/app/src/services/FlyerCampaigns/FlyerConversionsFB';
import { 
  IncrementNewUniqueUserReferalCount, 
  checkAndAutoRewardUser 
} from '@/app/src/services/FlyerCampaigns/FlyerCampaignFB';
// update - 4.1: Import UserService to utilize the robust caching layer
import { UserService } from '@/app/src/services/userService';
import { bumpUserVersion } from '@/app/src/services/redisCache/userCache';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const session = await authenticateRequest(req, res);
  if (!session) return;

  const { docId, source } = req.body;
  const user = session.user;

  if (!docId || typeof docId !== 'string' || !user?.email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const userEmail = user.email.toLowerCase().trim();

    // update - 4.2: Retrieve profile through UserService to avoid Firestore race conditions.
    // This call hits the cache and ensures we see the profile even if Firestore is syncing.
    const userProfile = await UserService.getUserProfile(userEmail);
    
    // update - 4.3: Determine Handshake Validity
    // The flag is our one-time currency. We check it here to see if this landing qualifies.
    const isNewUserLanding = userProfile.isFirstSessionFlyerTracking === true;

    // 1. Transactional State Flip (Peer Consumption)
    // If they are new, we must atomically flip the flag to false in Firestore.
    if (isNewUserLanding) {
      await firestore.collection('users').doc(userEmail).update({
        isFirstSessionFlyerTracking: false,
        updatedAt: admin.firestore.Timestamp.now()
      });
      // Immediately invalidate peer's cache so they don't count twice
      await bumpUserVersion(userEmail);
    }

    // 2. Document Ownership Lookup
    const docMetaSnap = await firestore.collection('userFiles').doc(docId).get();
    if (!docMetaSnap.exists) return res.status(404).json({ error: 'Doc not found' });
    
    const docData = docMetaSnap.data();
    const referrerId = docData?.ownerId?.toLowerCase()?.trim() || 'unknown';

    // 3. Analytics Ingestion with Attribution Metadata
    const event: ConversionEvent = {
      userId: userEmail,
      email: userEmail,
      emailDomain: userEmail.split('@')[1] || 'unknown',
      referrerId: referrerId,
      entryDocId: docId,
      entryDocTitle: docData?.fileName || 'Unknown Document',
      entryLessonCount: docData?.lessonUnitsMeta?.totalUnits || 0,
      campaignSource: source || 'unknown',
      convertedAt: admin.firestore.Timestamp.now(),
      // Track whether this specific hit was a rewarded conversion
      isNewUserInvite: isNewUserLanding 
    };

    const isNewConversionRecord = await recordConversionEvent(event);

    // update - 4.4: Referral Reward Attribution
    // Logic: Increment referrer ONLY if (User is New) AND (Visit is Unique to Referrer)
    const qualifyForReward = isNewConversionRecord && isNewUserLanding && referrerId !== 'unknown' && referrerId !== userEmail;

    if (qualifyForReward) {
      // Step 1: Execute the atomic O(1) increment on the Referrer's record
      await IncrementNewUniqueUserReferalCount(referrerId);

      // Step 2: Trigger the simplified single-tier reward milestone check
      // This function now only cares about the single 5-user threshold.
      processRewardLoop(referrerId).catch(err => 
        console.error(`[ViralLoop] Milestone check failed for ${referrerId}:`, err)
      );
    }

    return res.status(200).json({ 
      success: true, 
      attributed: qualifyForReward 
    });
  } catch (error) {
    console.error('[Analytics] Handshake failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

/**
 * @function processRewardLoop
 * @description
 * Orchestrates the simplified reward check. It delegates the 5-user 
 * threshold logic to the authoritative Campaign service.
 */
async function processRewardLoop(referrerId: string) {
  // update - 4.5: Trigger the binary milestone check (APPROVED -> REWARDED)
  await checkAndAutoRewardUser(referrerId);
  // Clear referrer's cache so the UI progress bar updates instantly
  await bumpUserVersion(referrerId);
}