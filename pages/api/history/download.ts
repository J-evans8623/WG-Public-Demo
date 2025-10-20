/***********************************************************************************************
 * @file pages/api/history/download.ts
 * @description
 *   Implements the GET /api/history/download endpoint for Bloom-Maps’ Version-History service.
 *   This endpoint issues a V4 signed GET URL for a specific snapshot ZIP in Cloud Storage,
 *   allowing clients to securely download the snapshot contents. In Phase 2 this handler was
 *   refactored to delegate all Firebase/Firestore/Storage work to the VersionHistoryFB adapter
 *   and to apply the NP rate-limit wrapper. The endpoint now focuses strictly on auth, input
 *   parsing, and response shaping. On success it returns { downloadUrl }. On failure it returns
 *   an appropriate error code. Purposeful logs mark major decision points for observability.
 *
 * Responsibilities:
 *   1) Authenticate the user via NextAuth.
 *   2) Validate `docId` and `snapshotId` query parameters.
 *   3) Use the adapter to read metadata and sign a V4 read URL (5-minute TTL).
 *   4) Return a JSON response or an error status with helpful diagnostics.
 ***********************************************************************************************/

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
// update - 1
import { getSnapshotMeta, signSnapshotDownloadUrl } from '@/app/src/services/calendar/versionhistory/VersionHistoryFb';
// update - 2
import { withRateLimitNP } from '@/app/src/services/rate-np/withRateLimitNP';

/**
 * @function handler
 * @description
 *   Handles authenticated GET requests for snapshot downloads. It validates the query params,
 *   uses the adapter to retrieve the snapshot metadata (to learn the GCS object path), then
 *   mints a signed V4 READ URL for that object. This function deliberately avoids any direct
 *   Firestore or Storage calls, delegating them to the adapter to improve testability.
 *
 * @param req - Next.js API request
 * @param res - Next.js API response
 */
async function handler(req: NextApiRequest, res: NextApiResponse) { // update - 3
  if (req.method !== 'GET') {
    console.log('download.ts 3001 › Invalid method:', req.method);
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const session = await authenticateRequest(req, res);
  if (!session) {
    console.log('download.ts 3002 › Unauthenticated request');
    return;
  }

  const docId = Array.isArray(req.query.docId) ? req.query.docId[0] : req.query.docId;
  const snapshotId = Array.isArray(req.query.snapshotId)
    ? req.query.snapshotId[0]
    : req.query.snapshotId;

  if (!docId || !snapshotId) {
    console.log('download.ts 3003 › Missing docId or snapshotId', { docId, snapshotId });
    return res.status(400).json({ error: 'Missing docId or snapshotId query parameter' });
  }
  console.log('download.ts 3004 › Download request for', { docId, snapshotId });

  try {
    // update - 4: use adapter to fetch metadata and sign read URL
    const meta = await getSnapshotMeta(docId, snapshotId);
    if (!meta || !meta.path) {
      console.log('download.ts 3005 › Snapshot metadata not found', { docId, snapshotId });
      return res.status(404).json({ error: 'Snapshot not found' });
    }
    console.log('download.ts 3006 › Found metadata, path=', meta.path);

    const { downloadUrl } = await signSnapshotDownloadUrl(meta.path);
    console.log('download.ts 3007 › Issued signed download URL for', meta.path);
    return res.status(200).json({ downloadUrl });
  } catch (err) {
    console.error('download.ts 3008 › Error generating download URL:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// update - 5: apply NP rate-limit wrapper for download scope
export default withRateLimitNP('np:vhDownload')(handler);
