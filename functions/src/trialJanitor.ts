/**
 * @file functions/src/trialJanitor.ts
 * @description
 * Scheduled Cloud Function to clean up expired referral trials.
 * This job runs every 24 hours to return lapsed ambassador accounts
 * back to 'freemium' status while shielding paying customers.
 */

import {onSchedule, ScheduledEvent} from "firebase-functions/v2/scheduler";
import admin from "firebase-admin";

const firestore = admin.firestore();

/**
 * @function trialJanitorJob
 * @description
 * Main scheduled task.
 * 1. Queries for 'premium' users with an expired 'premiumUntil' timestamp.
 * 2. Filters out any users with an active Stripe billing status.
 * 3. Performs an atomic batch update to reset tier to 'freemium'.
 */
export const trialJanitorJob = onSchedule(
  {schedule: "every 24 hours", timeZone: "UTC"},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (_event: ScheduledEvent) => {
    console.log("[trialJanitor.ts 5001] Starting daily trial expiration sweep");
    const now = admin.firestore.Timestamp.now();
    const batch = firestore.batch();

    try {
      // 1. Query potential expired trials
      const potentialExpired = await firestore.collection("users")
        .where("subscriptionTier", "==", "premium")
        .where("premiumUntil", "<", now)
        .limit(500)
        .get();

      if (potentialExpired.empty) {
        console.log("[trialJanitor.ts 5002] No expired trials found today");
        return;
      }

      let processedCount = 0;

      // 2. Validate against Billing Safety Gate
      potentialExpired.docs.forEach((doc) => {
        const userData = doc.data();
        const billing = userData.billing;

        // Skip if they are a paying customer (Active or Trialing on Stripe)
        const isPayingCustomer = billing &&
          (billing.status === "active" || billing.status === "trialing");

        if (!isPayingCustomer) {
          batch.update(doc.ref, {
            subscriptionTier: "freemium",
            updatedAt: now,
          });
          processedCount++;
        }
      });

      // 3. Commit if updates exist
      if (processedCount > 0) {
        await batch.commit();
        console.log(`[trialJanitor.ts 5003] Successfully
        reset ${processedCount} users to freemium`);
      }
    } catch (err) {
      console.error(`[trialJanitor.ts 5004] Critic
        al failure during sweep:`, err);
    }
  }
);
