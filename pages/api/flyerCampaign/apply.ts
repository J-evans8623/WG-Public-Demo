/**
 * @file pages/api/flyerCampaign/apply.ts
 * @description
 * API endpoint to record a user's application for the Flyer Campaign.
 * This file creates the record in 'referral_applications' that the 
 * administrator uses to approve or reject ambassadors.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { submitApplication } from '@/app/src/services/FlyerCampaigns/FlyerCampaignFB';
import { bumpUserVersion } from '@/app/src/services/redisCache/userCache';

/**
 * handler
 * @description
 * Processes the POST request from the FlyerModal. It verifies the user's
 * identity and hands off the data to the Firebase adapter for persistence.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Authenticate the user
  const session = await authenticateRequest(req, res);
  if (!session || !session.user?.email) return;


  const userEmail = session.user.email;
  const { universityName } = req.body;

  if (!universityName || typeof universityName !== 'string') {
    return res.status(400).json({ error: 'University name is required' });
  }

  try {
    // 2. Persist the application in Firestore
    // This creates the record you were looking for in the referral_applications collection
    await submitApplication(session.user.email, session.user.email, universityName);

    await bumpUserVersion(userEmail); // Invalidate stale cache
    console.log(`[FlyerAPI] Application recorded for ${session.user.email}`);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[FlyerAPI] Application failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}