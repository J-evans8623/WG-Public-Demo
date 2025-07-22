// File: pages/api/history/download.ts

/***********************************************************************************************
 * @file pages/api/history/download.ts
 * @description
 *   Implements the GET /api/history/download endpoint for Bloom-Maps’ Version-History service.
 *   This endpoint issues a V4 signed GET URL for a specific snapshot ZIP in Cloud Storage,
 *   allowing clients to securely download the snapshot contents. It authenticates the user,
 *   validates the `docId` and `snapshotId` query parameters, retrieves the metadata document
 *   from Firestore (ensuring the snapshot exists), extracts the storage `path`, and then
 *   requests a signed URL from the Firebase Admin SDK. The URL is returned in JSON. Errors
 *   due to missing parameters, missing metadata, authentication failures, or unexpected
 *   conditions return appropriate HTTP status codes with JSON error messages. Key
 *   execution points are logged with unique 4-digit codes for observability.
 *
 * Responsibilities:
 *   - Authenticate incoming requests via NextAuth.
 *   - Validate `docId` and `snapshotId` parameters.
 *   - Retrieve Firestore metadata to confirm existence and obtain storage path.
 *   - Generate V4 signed GET URL using Firebase Admin SDK.
 *   - Return JSON { downloadUrl } or error status.
 ***********************************************************************************************/

import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { firestore } from '@/app/src/services/firebase';

/**
 * @function handler
 * @description
 *   Handles authenticated GET requests for snapshot downloads. Expects `docId` and
 *   `snapshotId` query parameters. Validates presence, retrieves the corresponding
 *   Firestore metadata document under documents/{docId}/snapshots/{snapshotId}, and
 *   issues a V4 signed GET URL for the Cloud Storage file at `path`. Returns JSON
 *   with the URL or an error response if parameters are missing, metadata is absent,
 *   or any internal error occurs.
 *
 * @param req - Next.js API request
 * @param res - Next.js API response
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    const metaRef = firestore
      .collection('documents')
      .doc(docId)
      .collection('snapshots')
      .doc(snapshotId);
    const metaSnap = await metaRef.get();

    if (!metaSnap.exists) {
      console.log('download.ts 3005 › Snapshot metadata not found', { docId, snapshotId });
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    const { path } = metaSnap.data()!;
    console.log('download.ts 3006 › Found metadata, path=', path);

    const bucket = admin.storage().bucket();
    const file = bucket.file(path);
    const [downloadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 5 * 60 * 1000  // URL valid for 5 minutes
    });

    console.log('download.ts 3007 › Issued signed download URL for', path);
    return res.status(200).json({ downloadUrl });
  } catch (err) {
    console.error('download.ts 3008 › Error generating download URL:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
