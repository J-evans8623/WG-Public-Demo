/* eslint-disable max-len */
// File: functions/retentionJob.ts

/** ******************************************************
 * ***************************************
 * @file functions/retentionJob.ts
 * @description
 *   This Cloud Function implements the nightly retention
 *   job for Bloom-Maps’ Version-History service.
 *   It scans all documents that have snapshots, calculates
 *   a tiered retention policy to ensure total storage per document
 * remains under the 200 MB cap, and removes any snapshots beyond the policy.
 *   Specifically, it retains all snapshots in the last 24 hours, one per hour
 *  for snapshots 1–7 days old, one per day for snapshots 7–28 days old, and one
 *  per week for older snapshots, always keeping the newest snapshot
 *  regardless of age. It fetches snapshot metadata from Firestore under
 *  `documents/{docId}/snapshots/` uses the Firebase Admin SDK to delete
 *   outdated ZIP files from Cloud Storage, and removes corresponding
 *   metadata documents. Purposeful console.log statements
 *   with unique 4-digit codes provide observability at each
 *   major step. This file must be deployed
 *   with Cloud Scheduler to run once per night.
 *
 * Responsibilities:
 *   - List all document IDs from Firestore.
 *   - For each document, fetch snapshots ordered by timestamp ascending.
 *   - Compute which snapshots to keep based on tiered retention.
 *   - Delete snapshot files in Cloud Storage and metadata
 *  *    in Firestore for snapshots outside the keep set.
 *   - Log critical execution points and errors.
 *
 * @author
 * @date
 *******************************************************************/

import {onSchedule, ScheduledEvent} from "firebase-functions/v2/scheduler";
import admin from "firebase-admin";


const firestore = admin.firestore();
const bucket = admin.storage().bucket();

// Slot-tracking sets for tiered retention
const hourSlots = new Set<number>();
const daySlots = new Set<string>();
const weekSlots = new Set<string>();

/**
 * Applies the tiered retention policy to a sorted list of snapshots.
 *
 * Retains:
 *   1. All snapshots in the last 24 hours,
 *   2. One snapshot per hour for snapshots 1–7 days old,
 *   3. One snapshot per day for snapshots 7–28 days old,
 *   4. One snapshot per week for older than 28 days,
 *   5. Always the newest snapshot.
 *
 * @param {Array<{ id: string, ts: Date }>} snaps
 *   An array of snapshot metadata objects sorted from oldest to newest.
 *   Each object must have:
 *     - `id`: the snapshot’s unique identifier,
 *     - `ts`: a JavaScript `Date` when it was taken.
 *
 * @return {Set<string>}
 *   A set of snapshot IDs that should be kept according to the policy.
 */
function applyTieredPolicy(snaps: { id: string; ts: Date }[]): Set<string> {
  console.log("retentionJob.ts 4001 › Computing tiered retention for", snaps.length, "snapshots");
  const now = Date.now();
  const keep = new Set<string>();

  // Always keep newest
  if (snaps.length > 0) {
    keep.add(snaps[snaps.length - 1].id);
  }

  for (const snap of snaps) {
    const ageMs = now - snap.ts.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    // Last 24h: keep all
    if (ageMs <= 1000 * 60 * 60 * 24) {
      keep.add(snap.id);
      continue;
    }

    // 1–7 days: hourly slots
    if (ageDays <= 7) {
      const hourKey = Math.floor(snap.ts.getTime() / (1000 * 60 * 60));
      if (!hourSlots.has(hourKey)) {
        hourSlots.add(hourKey);
        keep.add(snap.id);
      }
      continue;
    }

    // 7–28 days: daily slots
    if (ageDays <= 28) {
      const dayKey = snap.ts.toISOString().slice(0, 10);
      if (!daySlots.has(dayKey)) {
        daySlots.add(dayKey);
        keep.add(snap.id);
      }
      continue;
    }

    // >28 days: weekly slots
    const weekNumber = Math.ceil((snap.ts.getUTCDate() + 6 - snap.ts.getUTCDay()) / 7);
    const weekKey = `${snap.ts.getUTCFullYear()}-W${weekNumber}`;
    if (!weekSlots.has(weekKey)) {
      weekSlots.add(weekKey);
      keep.add(snap.id);
    }
  }

  console.log("retentionJob.ts 4002 › Tiered retention selected", keep.size, "snapshots to keep");

  // Clear slot trackers for next run
  hourSlots.clear();
  daySlots.clear();
  weekSlots.clear();

  return keep;
}

export const retentionJob = onSchedule(
  {schedule: "every 24 hours", timeZone: "UTC"},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (_event: ScheduledEvent) => {
    console.log("retentionJob.ts 4003 › Starting nightly retention job");
    try {
      // 1) List all document IDs
      const docs = await firestore.collection("documents").listDocuments();
      for (const docRef of docs) {
        const docId = docRef.id;
        console.log("retentionJob.ts 4004 › Processing document:", docId);

        // 2) Fetch snapshots ordered oldest→newest
        const snapsColl = firestore.collection("documents").doc(docId).collection("snapshots");
        const snapsSnap = await snapsColl.orderBy("ts", "asc").get();
        const allSnaps = snapsSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ts: (data.ts as admin.firestore.Timestamp).toDate(),
            path: data.path as string,
          };
        });

        // 3) Compute retention set
        const keepSet = applyTieredPolicy(allSnaps);

        // 4) Delete snapshots outside retention set
        for (const snap of allSnaps) {
          if (!keepSet.has(snap.id)) {
            console.log("retentionJob.ts 4005 › Deleting snapshot", snap.id, "path=", snap.path);
            // Delete file
            try {
              await bucket.file(snap.path).delete();
              console.log("retentionJob.ts 4006 › Deleted file", snap.path);
            } catch (err) {
              console.error("retentionJob.ts 4007 › Error deleting file", snap.path, err);
            }
            // Delete metadata
            try {
              await snapsColl.doc(snap.id).delete();
              console.log("retentionJob.ts 4008 › Deleted metadata for", snap.id);
            } catch (err) {
              console.error("retentionJob.ts 4009 › Error deleting metadata for", snap.id, err);
            }
          }
        }
      }
      console.log("retentionJob.ts 4010 › Nightly retention job completed successfully");
    } catch (err) {
      console.error("retentionJob.ts 4011 › Unexpected error in retention job", err);
    }
  }
);
