/**
 * @file RecoverFiles.ts
 * @description 
 * This Next.js API handler serves as the authoritative endpoint for notebook restoration and 
 * recovery bin management. It provides a secure interface for owners to interact with their 
 * archived data. The endpoint supports 'GET' requests to list recoverable notebook metadata 
 * and 'POST' requests to initiate the restoration of a specific document. Security is enforced 
 * through mandatory request authentication, ensuring that only logged-in users can access 
 * the bin. Furthermore, the underlying service layer performs secondary ownership verification 
 * to prevent cross-user data restoration. This endpoint acts as a thin controller, delegating 
 * complex state transitions to the FileRetentionService while normalizing responses and 
 * error codes for a consistent frontend integration experience.
 * (136 words)
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { 
    getRecoveryBinMetadata, 
    restoreNotebook 
} from '@/app/src/services/FileRetentionService';

/**
 * @function handler
 * @description 
 * Orchestrates the GET (list bin) and POST (restore file) operations for the recovery system. 
 * It validates the incoming request method, hydrates the user session, and funnels parameters 
 * to the service layer. Standardized JSON responses and error mappings ensure the frontend 
 * can react predictably to success, authorization failures, or missing data scenarios.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // 1. Authenticate the caller
    const session = await authenticateRequest(req, res);
    if (!session) return; // authenticateRequest handles the 401 response

    const ownerEmail = session.user.email!;

    try {
        // 2. Handle GET request: List all files in the owner's bin
        if (req.method === 'GET') {
            console.log('RecoverFiles.ts [5001] › GET: Listing bin for', ownerEmail);
            const metadata = await getRecoveryBinMetadata(ownerEmail);
            return res.status(200).json({ files: metadata });
        }

        // 3. Handle POST request: Restore a specific document
        if (req.method === 'POST') {
            const { docId } = req.body;
            if (!docId) {
                return res.status(400).json({ error: 'Missing docId in request body' });
            }

            console.log('RecoverFiles.ts [5002] › POST: Restoring docId', docId);
            await restoreNotebook(docId, ownerEmail);

            return res.status(200).json({ 
                success: true, 
                message: 'Notebook successfully restored to library.',
                docId 
            });
        }

        // 4. Fallback for unsupported methods
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: 'Method Not Allowed' });

    } catch (err: any) {
        console.error('RecoverFiles.ts [5099] › error:', err.message);
        
        // Map service-layer errors to appropriate HTTP codes
        if (err.message === 'FILE_NOT_IN_RECOVERY_BIN') {
            return res.status(404).json({ error: err.message });
        }
        if (err.message === 'UNAUTHORIZED_RESTORATION_REQUEST') {
            return res.status(403).json({ error: err.message });
        }

        return res.status(500).json({ error: 'Internal Server Error' });
    }
}