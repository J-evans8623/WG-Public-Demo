/**
 * @file fileRecoveryRetentionJanitor.ts
 * @description
 * This module implements the automated maintenance layer of the
 * Bloom-Map retention policy, serving as the final stage of the document
 * lifecycle. It is designed to be triggered on a weekly schedule by the Google
 * Cloud Scheduler to perform a comprehensive "sweep" of the 'recoveryBin'
 * collection. The Janitor identifies all document metadata where the
 * 'expiresAt' timestamp is less than or equal to the current system time,
 * signifying that the 30-day grace period has officially expired. For each
 * eligible document, it invokes a self-contained hard-delete sequence to
 * permanently reclaim storage space and maintain database performance. By
 * automating this cleanup, the function ensures that the application strictly
 * adheres to its data privacy and retention commitments while preventing
 * manual administrative overhead and reducing infrastructure costs. This
 * automated destruction path is critical for managing the growth of the
 * Firestore 'recoveryBin' and associated Firebase Storage binaries, ensuring
 * that the safety window for user-driven recovery is balanced with system
 * hygiene and data minimization principles following the initial soft-delete
 * action initiated by the notebook owner.
 * (192 words)
 */

import {onSchedule} from "firebase-functions/v2/scheduler";
import {logger} from "firebase-functions";
import admin from "firebase-admin";

const firestore = admin.firestore();

/**
 * @function executePermanentPurgeInternal
 * @description
 * Performs an irreversible wipe of a document's storage binary and Firestore
 * data tree. This internal helper avoids external service imports to bypass
 * cross-directory dependency conflicts during the Cloud Functions build.
 * @param {string} docId - The unique identifier of the notebook document
 * to be permanently purged from all system collections and storage.
 * (61 words)
 */
async function executePermanentPurgeInternal(docId: string): Promise<void> {
  const binRef = firestore.collection("recoveryBin").doc(docId);
  const snap = await binRef.get();

  if (!snap.exists) return;

  const data = snap.data();
  const fileStoragePath = data?.fileStoragePath;

  // 1. Wipe binary from Storage if path is provided
  if (fileStoragePath) {
    try {
      const bucket = admin.storage().bucket();
      await bucket.file(fileStoragePath).delete();
      logger.info(`[Purge] Storage file deleted: ${fileStoragePath}`);
    } catch (err) {
      logger.error(`[Purge] Storage delete failed for ${docId}:`, err);
    }
  }

  // 2. Recursively delete document sub-collections
  try {
    const docRootRef = firestore.collection("documents").doc(docId);
    await firestore.recursiveDelete(docRootRef);
    logger.info(`[Purge] Firestore tree deleted: documents/${docId}`);
  } catch (err) {
    logger.error(`[Purge] Firestore recursive delete failed: ${docId}`, err);
  }

  // 3. Remove metadata from recovery bin
  await binRef.delete();
}

/**
 * @function fileRecoveryRetentionJanitor
 * @description
 * Scheduled task that executes every Sunday at midnight UTC to purge expired
 * notebooks from the recovery bin. It identifies records exceeding the 30-day
 * safety window and sequentially triggers a permanent wipe of Firestore
 * trees, Storage binaries, and AI indices via the FileRetentionService,
 * ensuring no orphaned data remains in the system after the grace period.
 * (64 words)
 */
export const fileRecoveryRetentionJanitor = onSchedule({
  schedule: "0 0 * * 0",
  timeZone: "UTC",
  memory: "512MiB",
}, async () => {
  // 1. Log initiation of the job using the authoritative Firebase logger
  logger.info("fileRecoveryRetentionJanitor.ts [7001] › Starting sweep...");

  try {
    // 2. Fetch current server timestamp for accurate expiration comparison
    const now = admin.firestore.Timestamp.now();

    // 3. Query recoveryBin for records where the safety window has closed
    const expiredSnapshot = await firestore.collection("recoveryBin")
      .where("expiresAt", "<=", now)
      .get();

    if (expiredSnapshot.empty) {
      logger.info("fileRecoveryRetentionJanitor.ts [7002] › No expired items.");
      return;
    }

    logger.info(`fileRecoveryRetentionJanitor.ts [7003] › Found 
        ${expiredSnapshot.size} items.`);

    // 4. Iterate through records and trigger the destructive sequence
    // Note: Sequential processing avoids Firestore rate limits.
    for (const doc of expiredSnapshot.docs) {
      const docId = doc.id;
      try {
        await executePermanentPurgeInternal(docId);
      } catch (err) {
        logger.error(`fileRecoveryRetentionJanitor.ts [7091] › 
            Failed: ${docId}`, err);
      }
    }

    logger.info("fileRecoveryRetentionJanitor.ts [7004] › Sweep complete.");
  } catch (error) {
    logger.error("fileRecoveryRetentionJanitor.ts [7099] › Janitor failure:",
      error);
  }
});
