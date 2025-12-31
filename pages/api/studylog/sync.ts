/**
 * @file pages/api/studylog/sync.ts
 * @description
 * Secure API endpoint for synchronizing Study Log data between the client and Firestore.
 * This endpoint implements the "Backend for Frontend" pattern, handling authentication,
 * rate limiting, and delegating actual database logic to the `StudyLogService`.
 *
 * Responsibilities:
 * 1. Authenticate the request using `authenticateRequest` (401 if failed).
 * 2. Enforce rate limits using `withRateLimitNP` scope `np:studyLogSync`.
 * 3. Handle GET requests to fetch the user's study log summary AND recent history.
 * 4. Handle POST requests to persist updated summary stats and new session history.
 * 5. Handle errors gracefully and return appropriate HTTP status codes.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { withRateLimitNP } from '@/app/src/services/rate-np/withRateLimitNP';
import {
  fetchStudyLogSummary,
  fetchRecentSessions, // update - 1
  saveStudyLogData
} from '@/app/src/services/study-log/StudyLogService';
import {
  StudyLogSummary,
  StudyLogSession
} from '@/app/Library/Definitions/StudyLogDefinitions';

/**
 * @function handler
 * @description
 * Main API handler for Study Log synchronization.
 * Supports GET (Fetch) and POST (Save).
 *
 * @steps
 * 1. Authenticate user.
 * 2. GET: Call `fetchStudyLogSummary` AND `fetchRecentSessions`. Return combined payload.
 * 3. POST: Validate body. Call `saveStudyLogData`. Return success.
 * 4. Handle 405 Method Not Allowed and 500 Internal Server Errors.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Step 1: Authenticate
  const session = await authenticateRequest(req, res);
  if (!session) return; // Response already handled by authenticateRequest

  const userId = session.user.email!;

  try {
    // Step 2: Handle GET (Read)
    if (req.method === 'GET') {
      // Parallel fetch for summary and history
      const [summary, recentSessions] = await Promise.all([ // update - 2
        fetchStudyLogSummary(userId),
        fetchRecentSessions(userId)
      ]);

      // Return 200 OK with data (or null if new user)
      return res.status(200).json({ 
        summary,
        recentSessions // update - 3
      });
    }

    // Step 3: Handle POST (Write)
    if (req.method === 'POST') {
      const { summary, newSessions } = req.body;

      // Basic validation
      if (!summary || typeof summary !== 'object') {
        return res.status(400).json({ error: 'Missing or invalid summary data' });
      }
      if (!Array.isArray(newSessions)) {
        return res.status(400).json({ error: 'Invalid newSessions array' });
      }

      await saveStudyLogData(
        userId,
        summary as StudyLogSummary,
        newSessions as StudyLogSession[]
      );

      return res.status(200).json({ success: true });
    }

    // Step 4: Handle Invalid Methods
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error) {
    console.error('[API study-log/sync] Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// Apply Rate Limiting
export default withRateLimitNP('np:studyLogSync')(handler);