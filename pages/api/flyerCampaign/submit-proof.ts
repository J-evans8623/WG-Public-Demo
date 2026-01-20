/**
 * @file pages/api/flyerCampaign/submit-proof.ts
 * @description
 * BFF API endpoint for submitting campaign flyer photos. This endpoint reuses 
 * the 'multer' dependency to handle multipart/form-data ingestion, maintaining 
 * a lean tech stack. It validates the user session and triggers the proof 
 * processing utility. It ensures that only authenticated users can upload 
 * proof and automatically links the upload to their normalized user ID.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import multer from 'multer';
import { authenticateRequest, EnhancedSession } from '@/app/src/auth/authenticateRequest';
import { processCampaignProof } from '@/app/src/services/FlyerCampaigns/ProofSubmission';
import { firestore } from '@/app/src/services/firebase';
import { bumpUserVersion } from '@/app/src/services/redisCache/userCache';


/** * Step 1: Configure multer to use memory storage. 
 * Since we are passing a Buffer to Firebase Storage, we don't need a local file path.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for phone photos
    files: 1,
  },
});

/** Disable standard body parsing to allow multer to handle the stream */
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * runMiddleware
 * @description
 * Helper to execute Express-style middleware (multer) in a Next.js API route.
 * @param req - The inbound request
 * @param res - The outbound response
 * @param fn - The middleware function
 */
const runMiddleware = (req: any, res: any, fn: any): Promise<any> => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
};

/**
 * handler
 * @description
 * Main request handler for physical proof submission using existing dependencies.
 * Step 1: Validates that the request is a POST.
 * Step 2: Authenticates the user session to identify the uploader.
 * Step 3: Runs multer middleware to extract the file into req.file.buffer.
 * Step 4: Calls ProofSubmission utility to persist data to Firebase.
 */
export default async function handler(
  req: NextApiRequest & { file?: any },
  res: NextApiResponse
) {
  // 1. Method Guard
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 2. Authentication: Ensure user is logged in
    const session = await authenticateRequest(req, res);
    if (!session || !session.user?.email) {
      return; // authenticateRequest handles the 401 response
    }

    const userId = session.user.email.toLowerCase().trim();

    // 3. Multipart Parsing: Reuse the project's existing multer middleware
    await runMiddleware(req, res, upload.single('file'));

    // 4. Validation: Check if a file was provided in the buffer
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // 5. Processing: Delegate to the FlyerCampaign service using the memory buffer
    const storagePath = await processCampaignProof(userId, req.file.buffer);


    // update - 2: PATCHED Administrative Handover
    // Atomically move Alexander to the 'SUBMITTED' state so the Admin can review the photo.
    await firestore.collection('referral_applications').doc(userId).update({
      status: 'SUBMITTED',
      proofPath: storagePath,
      submittedAt: new Date().toISOString()
    });

    // This ensures the CampaignUIOrchestrator sees the 'SUBMITTED' state instantly.
    await bumpUserVersion(userId);

    return res.status(200).json({ 
      success: true, 
      message: 'Proof submitted for review',
      path: storagePath 
    });

  } catch (error) {
    console.error('[API submit-proof] Submission failed:', error);
    return res.status(500).json({ 
      error: 'Internal server error during submission',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}