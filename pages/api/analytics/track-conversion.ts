/**
 * @file pages/api/analytics/track-conversion.ts (Refactored)
 * @description
 * Centralized ingestion point for conversion analytics. This endpoint 
 * coordinates with FlyerConversionsFB for data persistence and 
 * FlyerCampaignFB for automated reward logic.
 * Logic uses Step-by-Step imports to maintain separation of concerns.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { firestore } from '@/app/src/services/firebase';
import * as admin from 'firebase-admin';

// update - 1: Importing decoupled adapters
import { recordConversionEvent, ConversionEvent } from '@/app/src/services/FlyerCampaigns/FlyerConversionsFB';
import { getUniqueReferralCount, rewardUserTier } from '@/app/src/services/FlyerCampaigns/FlyerCampaignFB';

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
    // 1. Context Snapshotting: Identify the document and its owner
    const docMetaSnap = await firestore.collection('userFiles').doc(docId).get();
    if (!docMetaSnap.exists) return res.status(404).json({ error: 'Doc not found' });
    
    const docData = docMetaSnap.data();
    const referrerId = docData?.ownerId?.toLowerCase()?.trim() || 'unknown';

    // 2. Analytics Ingestion: Hand off to the specialized conversion adapter
    const event: ConversionEvent = {
      userId: user.email,
      email: user.email,
      emailDomain: user.email.split('@')[1] || 'unknown',
      referrerId: referrerId,
      entryDocId: docId,
      entryDocTitle: docData?.fileName || 'Unknown Document',
      entryLessonCount: docData?.lessonUnitsMeta?.totalUnits || 0,
      campaignSource: source || 'unknown',
      convertedAt: admin.firestore.Timestamp.now()
    };

    const isNewConversion = await recordConversionEvent(event); // update - 2

    // 3. Decoupled Reward Logic: Trigger background loop only for new unique doc hits
    if (isNewConversion && referrerId !== 'unknown' && referrerId !== user.email) {
      processRewardMilestones(referrerId).catch(err => 
        console.error(`[ViralLoop] Milestone check failed for ${referrerId}:`, err)
      );
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Analytics] Tracking failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

/**
 * processRewardMilestones
 * @description Background logic to check thresholds using the encapsulated arithmetic.
 */
async function processRewardMilestones(referrerId: string) {
  // update - 3: Using the encapsulated Peer-Unique arithmetic logic
  const uniqueCount = await getUniqueReferralCount(referrerId);
  
  const appRef = firestore.collection('referral_applications').doc(referrerId);
  const appSnap = await appRef.get();
  if (!appSnap.exists) return;

  const reachedMilestones = appSnap.data()?.reachedMilestones || [];
  let daysToGrant = 0;
  let newMilestone = '';

  // logic for 5, 10, 20 scans thresholds...
  if (uniqueCount >= 20 && !reachedMilestones.includes('tier_20')) {
    daysToGrant = 14; newMilestone = 'tier_20';
  } else if (uniqueCount >= 10 && !reachedMilestones.includes('tier_10')) {
    daysToGrant = 7; newMilestone = 'tier_10';
  } else if (uniqueCount >= 5 && !reachedMilestones.includes('tier_5')) {
    daysToGrant = 7; newMilestone = 'tier_5';
  }

  if (daysToGrant > 0) {
    await rewardUserTier(referrerId, daysToGrant);
    await appRef.update({
      reachedMilestones: admin.firestore.FieldValue.arrayUnion(newMilestone),
      totalUniquePeers: uniqueCount
    });
  }
}