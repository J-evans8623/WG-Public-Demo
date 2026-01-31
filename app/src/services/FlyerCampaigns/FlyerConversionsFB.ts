/**
 * @file FlyerConversionsFB.ts
 * @description
 * Backend adapter for marketing conversion analytics. This file encapsulates the
 * logic for recording "Handshake" events between users and documents. Its primary
 * goal is to maintain the integrity of the data acquisition process by ensuring
 * that unique document landings are logged for trend analysis.
 */

import { firestore } from "../firebase";
import * as admin from 'firebase-admin';
import { checkAndAutoRewardUser } from "./FlyerCampaignFB";

/** Data structure for a conversion event log */
export interface ConversionEvent {
  userId: string;
  email: string;
  emailDomain: string;
  referrerId: string;
  entryDocId: string;
  entryDocTitle: string;
  entryLessonCount: number;
  campaignSource: string;
  convertedAt: admin.firestore.Timestamp;
  isNewUserInvite: boolean;
}

/**
 * recordConversionEvent
 * @description
 * Persists a unique conversion event to Firestore. It uses a composite key of 
 * (StudentEmail + DocID) to ensure that repeated visits to the same document 
 * by the same user do not inflate analytics.
 * @param event - The structured conversion data snapshot.
 * @returns Promise resolving to boolean: true if new record was created, false if duplicate.
 */
export async function recordConversionEvent(event: ConversionEvent): Promise<boolean> {
  // 1. Create a deterministic composite key for document-level deduplication
  const compositeKey = `${event.email}_${event.entryDocId}`;
  const conversionRef = firestore.collection('marketing_conversions').doc(compositeKey);

  try {
    // 2. Perform a transaction-less check for existence to optimize write speed
    const snap = await conversionRef.get();
    if (snap.exists) {
      return false; // Already tracked for this specific document
    }

    // NEW: Automatically check if the referrer has reached the milestone
    // This removes all manual administrative overhead for the 5-referral reward.
    await checkAndAutoRewardUser(event.referrerId);

    // 3. Persist the record for analytics and future reward derivation
    await conversionRef.set(event);
    console.log(`[FlyerConversionsFB] Conversion logged: ${event.email} -> ${event.entryDocId}`);
    return true;
  } catch (error) {
    console.error('[FlyerConversionsFB] Failed to log conversion:', error);
    throw error;
  }
}