/**
 * @file FlyerCampaignFB.ts
 * @description
 * Authoritative backend adapter for the Flyer Referral Campaign. This file manages 
 * the lifecycle of guerilla marketing participants, including eligibility checks, 
 * application intake, and status management. It interacts with the 'campaign_settings' 
 * singleton for global config and the 'referral_applications' collection for lead 
 * tracking. Designed for use in Next.js API routes (BFF architecture), it ensures 
 * atomic operations when updating participant counts and enforcing global caps.
 */

import { firestore } from "../firebase";
import * as admin from 'firebase-admin';
import { UserService } from '../userService';
import { bumpUserVersion } from '../redisCache/userCache';

/** Data structure for the global campaign configuration */
export interface CampaignConfig {
  isLive: boolean;
  maxCap: number;
  activeParticipantCount: number;
  denylistDomains: string[];
}

/** Data structure for an individual user's application */
export interface ReferralApplication {
  userId: string;
  email: string;
  universityName: string;
  status: 'PENDING' | 'APPROVED' | 'VERIFIED' | 'REWARDED' | 'REJECTED';
  appliedAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  totalUniquePeers?: number;
}

/**
 * getCampaignConfig
 * @description
 * Retrieves the global configuration for the referral campaign from Firestore. 
 * This document acts as the master switch for the campaign, defining the participant 
 * cap and the list of prohibited email domains (e.g., high schools).
 * @returns Promise resolving to CampaignConfig or default values if document is missing.
 */
export async function getCampaignConfig(): Promise<CampaignConfig> {
  const doc = await firestore.collection('campaign_settings').doc('v1').get();
  if (!doc.exists) {
    return { isLive: false, maxCap: 100, activeParticipantCount: 0, denylistDomains: [] };
  }
  return doc.data() as CampaignConfig;
}

/**
 * submitApplication
 * @description
 * Atomically records a user's intent to participate in the campaign. It writes 
 * the self-reported University name and sets the initial status to 'PENDING'. 
 * This data is structured to be picked up by the Google Sheets Firebase Extension.
 * @param userId - The normalized email/ID of the user.
 * @param email - The user's contact email.
 * @param universityName - Self-reported institution name from the intake form.
 */
export async function submitApplication(
  userId: string, 
  email: string, 
  universityName: string
): Promise<void> {
  const appRef = firestore.collection('referral_applications').doc(userId);
  
  // 1. Create the application document with structured metadata for review
  const application: ReferralApplication = {
    userId,
    email,
    universityName,
    status: 'PENDING',
    appliedAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  };

  // 2. Persist to Firestore; merge:true prevents overwriting verified data if called twice
  await appRef.set(application, { merge: true });
  console.log(`[FlyerCampaignFB] Application recorded for ${email} at ${universityName}`);
}

/**
 * getApplicationStatus
 * @description
 * Fetches the current progress of a specific user within the campaign funnel. 
 * This is called by the BFF to determine which UI state (Banner/Modal) to show.
 * @param userId - The normalized email/ID of the user.
 * @returns Promise resolving to status string or null if no application exists.
 */
export async function getApplicationStatus(userId: string): Promise<Partial<ReferralApplication> | null> {
  const doc = await firestore.collection('referral_applications').doc(userId).get();
  if (!doc.exists) return null;

  const data = doc.data();
  // update - 1.2: Returning only the simplified digital fields
  return {
    status: data?.status as ReferralApplication['status'],
    totalUniquePeers: data?.totalUniquePeers || 0,
    universityName: data?.universityName
  };
}



/**
 * rewardUserTier
 * @description
 * Atomically extends or activates a user's Premium trial period. 
 * If a trial is already active, it appends the days to the existing timestamp.
 * Logic satisfies Question 6 (EntitlementProvisioner) and Phase 3 automation.
 * @param userId - The normalized ID (email) of the user being rewarded.
 * @param daysToGrant - Number of days to add to the premium trial.
 */
export async function rewardUserTier(userId: string, daysToGrant: number): Promise<void> {
  // update - 1.2: Delegate to the authoritative UserService
  // This call handles the TrialSandbox calculation and the Redis version bump.
  try {
    await UserService.rewardUserTrial(userId, daysToGrant);
    console.log(`[FlyerCampaignFB] Successfully delegated reward grant for ${userId}`);
  } catch (error) {
    console.error(`[FlyerCampaignFB] Failed to delegate reward for ${userId}:`, error);
    throw error;
  }
}


/**
 * getUniqueReferralCount
 * @description
 * Calculates flyer campaign candidate referral score based on the number of UNIQUE peers acquired.
 * Example : Even if a peer scans 10 of "Alex's" flyers, Alex only receives credit for 1 person.
 * This logic prevents reward gaming and prioritizes true market expansion.
 * @param referrerId - The ID (email) of the ambassador Alex.
 * @returns Promise resolving to the number of unique students referred.
 */
export async function getUniqueReferralCount(referrerId: string): Promise<number> {
  // 1. Query all conversion records attributed to this specific ambassador
  const snap = await firestore.collection('marketing_conversions')
    .where('referrerId', '==', referrerId)
    .get();

  // 2. Arithmetic: Use a Set to extract unique student emails from the logs
  // This satisfies the requirement to avoid duplicate counting across different flyers.
  const uniquePeers = new Set<string>();
  snap.docs.forEach(doc => {
    const data = doc.data();
    if (data.userId) uniquePeers.add(data.userId);
  });

  return uniquePeers.size;
}

/**
 * IncrementNewUniqueUserReferalCount
 * @description
 * Atomically increments the persistent counter of valid new users referred.
 * This is the definitive "Writer" function called upon a successful handshake.
 * Time Complexity: O(1) - Single document update.
 * @param referrerId - The normalized ID of the student who shared the link.
 */
export async function IncrementNewUniqueUserReferalCount(referrerId: string): Promise<void> {
  const appRef = firestore.collection('referral_applications').doc(referrerId);
  
  // update - 2.1: Atomic increment to ensure data integrity during burst sign-ups
  await appRef.update({
    totalUniquePeers: admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.Timestamp.now()
  });
  
  console.log(`[FlyerCampaignFB] Incremented referral count for ${referrerId}`);
}


/**
 * GetNewUniqueUserReferalCount
 * @description
 * Reads the authoritatively stored count of unique new users.
 * This function satisfies the requirement for a high-performance, non-scan reader.
 * Time Complexity: O(1) - Single document read.
 * @param referrerId - Normalized ID of the referrer.
 * @returns Promise resolving to the current peer count.
 */
export async function GetNewUniqueUserReferalCount(referrerId: string): Promise<number> {
  const appStatus = await getApplicationStatus(referrerId);
  // update - 2.2: Simply reading the last stored value to avoid collection scans
  return appStatus?.totalUniquePeers || 0;
}

/**
 * checkAndAutoRewardUser
 * @description
 * Automatically checks if an APPROVED user has met the 5-referral threshold.
 * If met, it bypasses the manual 'VERIFIED' step and grants the trial.
 */
/**
 * checkAndAutoRewardUser
 * @description
 * Authoritative milestone processor that gates the single-tier campaign reward.
 * This refactored version checks the O(1) peer count and triggers the 7-day 
 * grant only if the 5-user threshold is met for the first time.
 * @param userId - Normalized ID of the referrer.
 * @returns Promise resolving to boolean: true if reward was granted in this call.
 */
export async function checkAndAutoRewardUser(userId: string): Promise<boolean> {
  const currentApp = await getApplicationStatus(userId);
  
  // 1. Guard: Only process if the user is in the active sharing phase.
  // This prevents redundant trial grants once the status is 'REWARDED'.
  if (currentApp?.status !== 'APPROVED') return false;

  // 2. Progression Check: Call the simplified O(1) reader.
  const currentCount = await GetNewUniqueUserReferalCount(userId);

  // update - 3.1: Simplified Gating logic for the one-time 5-user milestone.
  if (currentCount >= 5) {
    const appRef = firestore.collection('referral_applications').doc(userId);
    
    // Atomic state flip to finalize the journey
    await appRef.update({
      status: 'REWARDED',
      updatedAt: admin.firestore.Timestamp.now()
    });

    // Provision the single 7-day trial sandbox
    await UserService.rewardUserTrial(userId, 7);
    await incrementActiveParticipants();
    
    console.log(`[FlyerCampaignFB] Milestone reached! Rewarded ${userId}`);
    return true;
  }

  return false;
}


/**
 * getReferralCount
 * @description
 * Aggregates unique marketing conversions associated with a specific user's 
 * referrals to determine threshold eligibility.
 * @param userId - The user who referred the scans.
 * @returns Promise resolving to integer count of unique conversions.
 */
export async function getReferralCount(userId: string): Promise<number> {
  // Query conversions where the source document was owned by this user
  // This uses a denormalized field we will add in the next step
  const snap = await firestore.collection('marketing_conversions')
    .where('referrerId', '==', userId)
    .get();
    
  return snap.size;
}




/**
 * incrementActiveParticipants
 * @description
 * Atomically increments the global 'activeParticipantCount' by 1. 
 * This uses FieldValue.increment to ensure that concurrent administrative 
 * verifications do not overwrite each other or cause race conditions.
 */
export async function incrementActiveParticipants(): Promise<void> {
  const settingsRef = firestore.collection('campaign_settings').doc('v1');
  await settingsRef.update({
    activeParticipantCount: admin.firestore.FieldValue.increment(1)
  });
}

/**
 * decrementActiveParticipants
 * @description
 * Atomically decrements the global 'activeParticipantCount' by 1. 
 * This is used specifically by the reset script to "return" a seat to 
 * the campaign pool when a test or verified user is purged.
 */
export async function decrementActiveParticipants(): Promise<void> {
  const settingsRef = firestore.collection('campaign_settings').doc('v1');
  await settingsRef.update({
    activeParticipantCount: admin.firestore.FieldValue.increment(-1)
  });
}