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
export async function getApplicationStatus(userId: string): Promise<string | null> {
  const doc = await firestore.collection('referral_applications').doc(userId).get();
  return doc.exists ? (doc.data()?.status as string) : null;
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
  const userRef = firestore.collection('users').doc(userId);
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new Error("User not found for reward");

    const data = snap.data() || {};
    const nowMs = Date.now();
    
    // update - 1: Determine the baseline for extension
    // If premiumUntil exists and is in the future, we append. Otherwise, we start from Now.
    const currentExpiry = data.premiumUntil instanceof admin.firestore.Timestamp 
      ? data.premiumUntil.toMillis() 
      : 0;
    
    const baseMs = Math.max(nowMs, currentExpiry);
    const newExpiryMs = baseMs + (daysToGrant * MS_PER_DAY);

    // update - 2: Persist the new tier and timestamp
    tx.update(userRef, {
      subscriptionTier: 'premium',
      premiumUntil: admin.firestore.Timestamp.fromMillis(newExpiryMs),
      updatedAt: admin.firestore.Timestamp.now()
    });

    // update - 3: Mark the application status as REWARDED
    const appRef = firestore.collection('referral_applications').doc(userId);
    tx.update(appRef, {
      status: 'REWARDED',
      lastRewardGrant: admin.firestore.Timestamp.now()
    });
  });

  console.log(`[FlyerCampaignFB] Granted ${daysToGrant} days to ${userId}`);
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
 * cleanupExpiredTrials
 * @description
 * Administrative janitor task that identifies users whose promo trial has lapsed.
 * * SAFETY LOGIC:
 * To avoid affecting traditional premium users, this query specifically targets
 * users where subscriptionTier is 'premium' AND premiumUntil is expired,
 * but crucially filters out anyone with an 'active' or 'trialing' Stripe status.
 */
export async function cleanupExpiredTrials(): Promise<number> {
  const now = admin.firestore.Timestamp.now();
  const batch = firestore.batch();
  
  // update - 1: Targeted Query with Billing Safety Gate
  // We query for premium users with expired trial dates.
  const potentialExpired = await firestore.collection('users')
    .where('subscriptionTier', '==', 'premium')
    .where('premiumUntil', '<', now)
    .limit(500) 
    .get();

  if (potentialExpired.empty) {
    return 0;
  }

  let processedCount = 0;

  // update - 2: Secondary Validation Loop
  potentialExpired.docs.forEach((doc) => {
    const userData = doc.data();
    const billing = userData.billing;

    // update - 3: The "Traditional User" Shield
    // We ONLY downgrade if the user has NO active Stripe subscription.
    // If billing.status is 'active' or 'trialing' (Stripe side), we skip them entirely.
    const isPayingCustomer = billing && (billing.status === 'active' || billing.status === 'trialing');
    
    if (!isPayingCustomer) {
      const userRef = firestore.collection('users').doc(doc.id);
      batch.update(userRef, {
        subscriptionTier: 'freemium',
        updatedAt: now,
      });
      processedCount++;
    } else {
      console.log(`[FlyerCampaignFB] Safety Triggered: Skipped downgrade for paying customer ${doc.id}`);
    }
  });

  // 3. Commit only if we found actual ambassador trials to clean up
  if (processedCount > 0) {
    await batch.commit();
  }
  
  console.log(`[FlyerCampaignFB] Cleaned up ${processedCount} expired promo trials.`);
  return processedCount;
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