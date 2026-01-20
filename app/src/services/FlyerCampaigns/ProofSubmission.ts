/**
 * @file ProofSubmission.ts
 * @description
 * Server-side utility for processing and storing physical marketing proof.
 * This file manages the ingestion of flyer photos from students into Firebase Storage
 * and updates the 'referral_applications' collection status. It centralizes 
 * bucket path logic to ensure organized ambassador auditing.
 */

import { firestore } from "../firebase";
import admin from "firebase-admin";

/**
 * processCampaignProof
 * @description
 * Handles the storage of a campaign photo and transitions the user's status.
 * Step 1: Saves the image buffer to campaign_proofs/{userId}/{timestamp}.jpg.
 * Step 2: Updates the application status to 'VERIFIED' for founder review.
 * Step 3: Returns the public or internal storage path for the admin dashboard.
 * @param userId - The normalized ID of the submitting user.
 * @param buffer - The raw image data from the multipart form.
 * @returns Promise resolving to the storage destination path.
 */
export async function processCampaignProof(
  userId: string,
  buffer: Buffer
): Promise<string> {
  // 1. Initialize storage bucket and define canonical path
  const bucket = admin.storage().bucket();
  const timestamp = Date.now();
  const destination = `campaign_proofs/${userId}/${timestamp}_flyer.jpg`;

  try {
    // 2. Save the file to Firebase Storage with appropriate metadata
    const file = bucket.file(destination);
    await file.save(buffer, {
      metadata: {
        contentType: 'image/jpeg',
        metadata: {
          ownerId: userId,
          type: 'flyer_proof'
        }
      }
    });

    // 3. Update the application status in Firestore
    // This transitions the user from 'APPROVED' to 'VERIFIED'
    const appRef = firestore.collection('referral_applications').doc(userId);
    await appRef.update({
      status: 'VERIFIED',
      updatedAt: admin.firestore.Timestamp.now(),
      proofPath: destination
    });

    console.log(`[ProofSubmission] Proof stored successfully for ${userId} at ${destination}`);
    return destination;

  } catch (error) {
    console.error(`[ProofSubmission] Error processing proof for ${userId}:`, error);
    throw new Error("Failed to process campaign proof");
  }
}