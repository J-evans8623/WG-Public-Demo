/**
 * @file pages/api/flyerCampaign/status.ts
 * @description
 * This authenticated API route serves as the "Read Truth" for the Referral Campaign.
 * Its primary responsibility is to provide the frontend sidecar hook (useCampaignTrial)
 * with real-time metrics, specifically the 'totalUniquePeers' and 'status' fields 
 * from the 'referral_applications' collection. By providing a dedicated endpoint 
 * for campaign data, we maintain the Single Responsibility Principle, ensuring the 
 * core user profile remains lean while the marketing dashboard receives high-performance 
 * O(1) data hydration. This resolves the 404 disconnect by establishing the 
 * necessary server-side handler for the digital referral progress tracker.
 *
 * Responsibilities:
 * - Authenticate the requesting user via NextAuth session.
 * - Retrieve the specific referral application document from Firestore.
 * - Return a structured JSON object containing the unique peer count and current campaign state.
 * - Provide a safe fallback (0 peers, ELIGIBLE status) if no application record exists.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { getApplicationStatus } from '@/app/src/services/FlyerCampaigns/FlyerCampaignFB';

/**
 * handler
 * @description
 * Main request handler for retrieving the campaign metrics. It validates 
 * the session and delegates the database lookup to the specialized 
 * FlyerCampaignFB adapter.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Method Guard: Only allow GET requests for status retrieval
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // 2. Authentication: Ensure the user is logged in
    const session = await authenticateRequest(req, res);
    if (!session || !session.user?.email) {
      // authenticateRequest handles the 401 response if session is missing
      return; 
    }

    const userId = session.user.email.toLowerCase().trim();

    // 3. Data Retrieval: Perform the O(1) document lookup
    // This calls the refactored getApplicationStatus from Phase 2.b
    const appStatus = await getApplicationStatus(userId);

    // 4. Response: Return the metrics or a safe baseline if the user hasn't applied yet
    if (appStatus) {
      return res.status(200).json({
        totalUniquePeers: appStatus.totalUniquePeers || 0,
        status: appStatus.status || 'ELIGIBLE'
      });
    } else {
      // User has no record in referral_applications yet
      return res.status(200).json({
        totalUniquePeers: 0,
        status: 'ELIGIBLE'
      });
    }

  } catch (error) {
    console.error('[FlyerAPI status] Retrieval failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}