/***********************************************************************************************
 * @file pages/api/history/snapshot.ts
 * @description
 *   Implements the “snapshotGuard” API endpoint for Bloom-Maps’ Version-History service.
 *   This endpoint:
 *     • Authenticates incoming requests via NextAuth.
 *     • Enforces a per-document, per-user sliding-window token bucket to rate-limit
 *       auto-snapshot requests (stored in Firestore `rateLimits` collection).
 *     • Generates a new snapshot ID and Cloud Storage signed PUT URL for uploading
 *       the per-map snapshot under `snapshots/{docId}/{snapshotId}.bloomdocx.zip`.
 *     • **Persists snapshot metadata** (docId, snapshotId, storage path, author, timestamp)
 *       into the Firestore `snapshots` collection so that `/api/history/list` can return
 *       the full history.
 *     • Returns HTTP 429 with a `Retry-After` header when rate limits are exceeded.
 *
 * Responsibilities:
 *   - Authenticate requests securely.
 *   - Maintain and mutate rate-limit tokens atomically.
 *   - Issue signed URLs for client uploads.
 *   - Record snapshot metadata for future listing.
 *   - Emit purposeful console logs with unique 4-digit codes for observability.
 *
 * Configuration:
 *   - WINDOW_LENGTH_SECONDS: length of each rate-limit window.
 *   - TOKENS_PER_WINDOW:    number of allowed snapshots per window.
 *
 ***********************************************************************************************/
import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { firestore } from '@/app/src/services/firebase';
import { v4 as uuidv4 } from 'uuid';

const WINDOW_LENGTH_SECONDS = 30;
const TOKENS_PER_WINDOW = 1;

interface RateLimitRecord {
  tokensRemaining: number;
  windowStart: admin.firestore.Timestamp;
  expireAt: admin.firestore.Timestamp;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    console.log('snapshot.ts 1001 › Invalid method:', req.method);
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // ── Authenticate user ───────────────────────────────────────────────────────────────
  const session = await authenticateRequest(req, res);
  if (!session) {
    console.log('snapshot.ts 1002 › Unauthenticated request');
    return; // authenticateRequest has already responded
  }
  const userId = session.user.email!;
  const docId = Array.isArray(req.query.docId) ? req.query.docId[0] : req.query.docId;
  const mapId = req.query.mapId;
  if (!docId) {
    console.log('snapshot.ts 1003 › Missing docId');
    return res.status(400).json({ error: 'Missing docId query parameter' });
  }
  console.log('snapshot.ts 1004 › Authenticated snapshot request:', { docId, userId });

  const rlKey = `${docId}_${userId}`;
  const rlRef = firestore.collection('rateLimits').doc(rlKey);
  const now = admin.firestore.Timestamp.now();

  try {
    // ── Rate-limit transaction ───────────────────────────────────────────────────────
    const rateRecord = await firestore.runTransaction(async tx => {
      const snap = await tx.get(rlRef);
      let record: RateLimitRecord;

      if (!snap.exists) {
        // New bucket
        record = {
          tokensRemaining: TOKENS_PER_WINDOW - 1,
          windowStart: now,
          expireAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + WINDOW_LENGTH_SECONDS * 1000)
        };
        console.log('snapshot.ts 1005 › Initialized rate-limit bucket for', rlKey);
      } else {
        record = snap.data() as RateLimitRecord;
        const elapsed = now.toMillis() - record.windowStart.toMillis();

        if (elapsed >= WINDOW_LENGTH_SECONDS * 1000) {
          // Window expired, reset
          record.tokensRemaining = TOKENS_PER_WINDOW - 1;
          record.windowStart = now;
          record.expireAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + WINDOW_LENGTH_SECONDS * 1000);
          console.log('snapshot.ts 1006 › Rate-limit window expired, reset for', rlKey);
        } else if (record.tokensRemaining > 0) {
          // Consume one token
          record.tokensRemaining -= 1;
          console.log('snapshot.ts 1007 › Consumed token, remaining=', record.tokensRemaining, 'for', rlKey);
        } else {
          // No tokens left in this window
          throw new Error('RATE_LIMIT_EXCEEDED');
        }
      }

      // Persist updated rate-limit state
      tx.set(rlRef, record, { merge: true });
      return record;
    });

    // ── Issue signed upload URL ────────────────────────────────────────────────────────
    const snapshotId = uuidv4();
    const filePath = `snapshots/${docId}/${snapshotId}.bloomdocx.zip`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(filePath);
    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 5 * 60 * 1000, // 5 minutes
      contentType: 'application/octet-stream'
    });
    console.log('snapshot.ts 1008 › Issued signed URL for snapshot', { docId, snapshotId, filePath });

    // ── FIXED: Persist snapshot metadata in correct collection structure ──────────────────────────────────────────
    // Changed from: firestore.collection('snapshots').doc(snapshotId)
    // To: firestore.collection('documents').doc(docId).collection('snapshots').doc(snapshotId)
    const metaRef = firestore
      .collection('documents')
      .doc(docId)
      .collection('snapshots')
      .doc(snapshotId);
    
    await metaRef.set({
      docId,
      mapId,
      title: req.body.title,
      snapshotId,
      path: filePath,
      author: userId,
      ts: admin.firestore.Timestamp.now(),
      size: 0 // Will be updated after upload completes (if needed)
    });
    console.log('snapshot.ts 1009 › Persisted snapshot metadata to documents/{docId}/snapshots/{snapshotId}', { 
      docId, 
      title: req.body.title,
      snapshotId, 
      author: userId, 
      path: filePath 
    });

    // ── Respond with signed URL and metadata stub ─────────────────────────────────────
    return res.status(200).json({ snapshotId, path: filePath, uploadUrl });

  } catch (err: any) {
    if (err.message === 'RATE_LIMIT_EXCEEDED') {
      // Compute Retry-After
      const snap = await rlRef.get();
      const record = snap.data() as RateLimitRecord;
      const elapsed = now.toMillis() - record.windowStart.toMillis();
      const retryAfter = Math.ceil((WINDOW_LENGTH_SECONDS * 1000 - elapsed) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      console.log('snapshot.ts 1010 › Rate limit exceeded, retry after', retryAfter, 'seconds');
      return res.status(429).json({ error: 'Too Many Requests', retryAfter });
    } else {
      console.error('snapshot.ts 1011 › Unexpected error:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}