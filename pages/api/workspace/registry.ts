/***************************************************************************************
 * @file pages/api/workspace/registry.ts
 * @description
 * Authoritative Backend-for-Frontend (BFF) endpoint responsible for serving the 
 * Predictive Workspace Registry. This endpoint satisfies the requirement for 
 * high-integrity functional identity resolution by providing a consolidated 
 * mapping of DocIDs to instructional context (isEducatorWorkspace) upon 
 * application mount. By anchoring the notebook's identity to the owner's 
 * account status, this route eliminates the race conditions and state 
 * flicker caused by volatile document properties. The handler enforces 
 * authentication via authenticateRequest.ts, ensuring that only signed-in 
 * users can access their participant registry. The resulting data structure 
 * enables the frontend to hydrate its session context in a single network 
 * call, providing the head-start needed to render instructional tools 
 * instantly without waiting for individual document provisioning handshakes.
 ***************************************************************************************/

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { fetchWorkspaceRegistry } from '@/app/src/services/FBworkspaceRegistry';
import { withRateLimitNP } from '@/app/src/services/rate-np/withRateLimitNP';

/**
 * @function handler
 * @description
 * Main API handler for the workspace registry. It validates the user's session, 
 * invokes the Firebase service to compute the functional identity map for 
 * all accessible documents, and returns the result as a JSON record. 
 * This is the Single Source of Truth (SSoT) for workspace context.
 * @param req - Standard Next.js API request object.
 * @param res - Standard Next.js API response object.
 */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  // 1. Method guard: Enforce read-only access for registry hydration
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. Authentication: Verify session via the standard project middleware
  // If not authenticated, the user is automatically handled/redirected by this helper.
  const session = await authenticateRequest(req, res);
  if (!session) return;

  try {
    const userEmail = session.user.email!;

    // 3. Logic Execution: Retrieve the predictive mapping from the service layer
    // This call computes educator status based on ownership status.
    const registry = await fetchWorkspaceRegistry(userEmail);

    // 4. Success Response: Return the authoritative map with no-store caching
    res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    console.log('[api/workspace/registry][2001] Registry successfully served', { 
      user: userEmail, 
      docCount: Object.keys(registry).length 
    });
    
    return res.status(200).json(registry);

  } catch (error) {
    console.error('[api/workspace/registry][2099] Failed to serve workspace registry', error);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// 5. Export with project-standard rate limiting applied
export default withRateLimitNP('nplistFiles')(handler);