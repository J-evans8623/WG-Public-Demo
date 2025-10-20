/***********************************************************************************************
 * @file pages/api/history/snapshot.ts
 * @description
 *   POST /api/history/snapshot mints a signed V4 WRITE URL for uploading a new snapshot and
 *   persists the snapshot metadata under `documents/{docId}/snapshots/{snapshotId}`. In Phase 2
 *   this handler was refactored to remove the Firestore token-bucket rate limiter and to adopt
 *   the NP rate-limit wrapper. All Firebase/Storage operations are delegated to the
 *   VersionHistoryFB adapter. The endpoint now performs authentication, input parsing, signing,
 *   metadata creation, and response shaping. Logs identify major steps, successes, and errors.
 *
 * Responsibilities:
 *   1) Authenticate the user via NextAuth.
 *   2) Parse and validate `docId`, `mapId` (optional), and `title` (optional) inputs.
 *   3) Generate a new `snapshotId` and corresponding storage path.
 *   4) Use the adapter to mint a signed WRITE URL (5-minute TTL) and to persist metadata.
 *   5) Return `{ snapshotId, path, uploadUrl }` or an error code with diagnostics.
 ***********************************************************************************************/

import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { createSnapshotMeta, signSnapshotUploadUrl } from '@/app/src/services/calendar/versionhistory/VersionHistoryFb';
import { withRateLimitNP } from '@/app/src/services/rate-np/withRateLimitNP';

/**
 * @function handler
 * @description
 *   Authenticates, creates a new snapshot ID, computes a storage path, signs a V4 WRITE URL,
 *   and persists the metadata. Rate-limiting is enforced externally via the NP wrapper. This
 *   function contains no Firestore queries or Storage calls directly; it relies on the adapter
 *   to keep the handler small and testable. On success, it returns `{ snapshotId, path, uploadUrl }`.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) { // update - 5
  if (req.method !== 'POST') {
    console.log('snapshot.ts 1001 › Invalid method:', req.method);
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = await authenticateRequest(req, res);
  if (!session) {
    console.log('snapshot.ts 1002 › Unauthenticated request');
    return;
  }
  const userId = session.user.email!;
  const docId = Array.isArray(req.query.docId) ? req.query.docId[0] : req.query.docId;
  const mapId = Array.isArray(req.query.mapId) ? req.query.mapId[0] : (req.query.mapId as string | undefined);
  const title = (req.body && typeof req.body.title === 'string') ? req.body.title : undefined;

  if (!docId) {
    console.log('snapshot.ts 1003 › Missing docId');
    return res.status(400).json({ error: 'Missing docId query parameter' });
  }
  console.log('snapshot.ts 1004 › Authenticated snapshot request:', { docId, userId });

  try {
    // update - 6: generate ids/paths and sign WRITE url via adapter
    const snapshotId = uuidv4();
    const filePath = `snapshots/${docId}/${snapshotId}.bloomdocx.zip`;

    const { uploadUrl } = await signSnapshotUploadUrl(filePath);
    console.log('snapshot.ts 1008 › Issued signed URL for snapshot', { docId, snapshotId, filePath });

    // update - 7: persist metadata via adapter
    await createSnapshotMeta({
      docId,
      snapshotId,
      path: filePath,
      author: userId,
      title,
      mapId,
      size: 0,
    });
    console.log('snapshot.ts 1009 › Persisted snapshot metadata to documents/{docId}/snapshots/{snapshotId}', {
      docId,
      title,
      snapshotId,
      author: userId,
      path: filePath,
    });

    // respond
    return res.status(200).json({ snapshotId, path: filePath, uploadUrl });
  } catch (err) {
    console.error('snapshot.ts 1011 › Unexpected error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// update - 8: apply NP rate-limit wrapper for snapshot create scope
export default withRateLimitNP('np:vhSnapshotCreate')(handler);
