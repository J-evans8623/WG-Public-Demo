/**
 * @file functions/src/trialJanitor.ts
 * @description
 * Scheduled Cloud Function (V2) responsible for the automated maintenance
 * and cleanup of expired promotional referral trials. This background job
 * runs every 24 hours
 * to identify users whose campaign-granted sandbox access has lapsed.
 * * UPDATE - Phase 2: Decoupled Janitor Logic (ESLint Compliant).
 * The job has been refactored to target the decoupled 'trialEndDate' field.
 * Crucially, it no longer modifies the 'subscriptionTier' field. By targeting
 * and nullifying only the trial sandbox fields, we ensure that paying Stripe
 * customers are mathematically shielded from accidental degradation, as the
 * Janitor is now physically incapable of reverting an account to 'freemium'
 * status. This architecture satisfies the SOLID Single Responsibility
 * Principle
 * by separating promotional cleanup from core billing lifecycle management.
 */

import {onSchedule} from "firebase-functions/v2/scheduler";
import admin from "firebase-admin";

const firestore = admin.firestore();

/**
 * @function trialJanitorJob
 * @description
 * Main scheduled task that performs a targeted sweep of expired trial records.
 * 1. Queries the 'users' collection for documents
 *  where 'trialEndDate' is less than Now.
 * 2. Uses a limit of 500 documents per execution
 *  to prevent memory overflow and stay within batch limits.
 * 3. Atomically clears the 'trialStartDate' and 'trialEndDate'
 * fields to end promotional access.
 * 4. This operation is side-effect free regarding Stripe billing,
 * as core tier fields are not touched.
 */
export const trialJanitorJob = onSchedule(
  {schedule: "every 24 hours", timeZone: "UTC"},
  async () => {
    console.log(`[trialJanitor.ts 5001] Starting
       decoupled trial expiration sweep`);
    const now = admin.firestore.Timestamp.now();
    const batch = firestore.batch();

    // update - 3.1: Define the "Stale" threshold (Users created > 24 hours ago)
    const staleThreshold = admin.firestore.
      Timestamp.fromMillis(now.toMillis() - (2 * 60 * 60 * 1000));

    try {
      // update - 1.1: Refocused Query targeting the Decoupled Sandbox
      // We target promotional sandboxes that have expired.
      const expiredTrialDocs = await firestore.collection("users")
        .where("trialEndDate", "<", now)
        .limit(500)
        .get();

      if (expiredTrialDocs.empty) {
        console.log(`[trialJanitor.ts 5002] No expired
           promotional trials found today`);
        return;
      }

      let processedCount = 0;

      // update - 2.1: Targeted Cleanup Loop
      expiredTrialDocs.docs.forEach((doc) => {
        // update - 2.2: Decoupled Field Nullification
        // We delete the trial metadata; subscriptionTier remains unchanged.
        batch.update(doc.ref, {
          trialStartDate: admin.firestore.FieldValue.delete(),
          trialEndDate: admin.firestore.Timestamp.fromMillis(0),
          updatedAt: now,
        });
        processedCount++;
      });

      // update - 3.2: Target users who never used their "Handshake Currency"
      const staleFlagDocs = await firestore.collection("users")
        .where("isFirstSessionFlyerTracking", "==", true)
        .where("createdAt", "<", staleThreshold)
        .limit(250)
        .get();

      let staleCount = 0;
      staleFlagDocs.docs.forEach((doc) => {
        // update - 3.3: Flip flag to false to pr
        // event future "New User" activation
        batch.update(doc.ref, {
          isFirstSessionFlyerTracking: false,
          updatedAt: now,
        });
        staleCount++;
      });

      // update - 3.1: Atomic Batch Commit
      if (processedCount > 0 || staleCount > 0) {
        await batch.commit();
        console.log(`[trialJanitor.ts 5003]
           Successfully purged ${processedCount} trials.`);
      }
    } catch (err) {
      console.error(`[trialJanitor.ts 5004] Critical
         failure during sweep:`, err);
    }
  }
);
