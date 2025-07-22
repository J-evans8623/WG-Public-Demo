/**
 * @file purgeExpiredInvites.ts
 * @responsibility
 *   Scheduled Cloud Function (daily) that:
 *     1) Marks invites as "archived" once their join window has closed.
 *     2) Permanently deletes archived invites older than RETENTION_DAYS.
 */

import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

/* ──────────────────────────────────────────────────────────────
 *  Firebase initialisation
 * ────────────────────────────────────────────────────────────── */

const firestore = admin.firestore();

/* ──────────────────────────────────────────────────────────────
 *  Constants
 * ────────────────────────────────────────────────────────────── */
const INVITES_COLLECTION = "invites";
const RETENTION_DAYS = parseInt(
  process.env.INVITE_RETENTION_DAYS || "30",
  10,
);

/* ──────────────────────────────────────────────────────────────
 *  Cloud-function: purgeExpiredInvites
 * ────────────────────────────────────────────────────────────── */
export const purgeExpiredInvites = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const retentionCutoff = admin.firestore.Timestamp.fromMillis(
      now.toMillis() - RETENTION_DAYS * 86_400_000, // 86 400 000 ms = 1 day
    );

    /** 1️⃣  Archive copies whose join-window closed but are still “active”. */
    const toArchive = await firestore
      .collection(INVITES_COLLECTION)
      .where("mode", "==", "copy")
      .where("joinWindowClosed", "==", true)
      .where("status", "==", "active")
      .get();

    const archiveBatch = firestore.batch();
    toArchive.docs.forEach((doc) => {
      archiveBatch.update(doc.ref, {status: "archived"});
    });
    await archiveBatch.commit();

    /** 2️⃣  Permanently delete archived invites older than retentionCutoff. */
    const toDelete = await firestore
      .collection(INVITES_COLLECTION)
      .where("status", "==", "archived")
      .where("expiresAt", "<=", retentionCutoff)
      .get();

    const deleteBatch = firestore.batch();
    toDelete.docs.forEach((doc) => {
      deleteBatch.delete(doc.ref);
    });
    await deleteBatch.commit();

    console.log(
      `Purged ${toArchive.size} invites to archived; ` +
        `deleted ${toDelete.size} archived invites older` +
        ` than ${RETENTION_DAYS} days.`,
    );
  });
