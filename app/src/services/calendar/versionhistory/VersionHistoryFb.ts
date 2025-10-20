/***********************************************************************************************
 * @file app/src/services/versionhistory/VersionHistoryFB.ts
 * @description
 *   This module centralizes **all** Firebase interactions for the Version History data layer.
 *   It provides a small, purpose-built surface for Firestore CRUD over snapshot metadata and
 *   for minting Google Cloud Storage V4 signed URLs used by the API endpoints. Consolidating
 *   these responsibilities into a single adapter removes Firebase logic from the endpoints,
 *   keeps handlers focused on auth + request/response shaping, and simplifies testing by
 *   allowing Firebase-dependent behavior to be mocked behind a stable API. The adapter avoids
 *   endpoint-specific business logic (e.g., “deleted” grouping) and returns normalized,
 *   plain JavaScript objects. Logging is intentionally sparse and targeted to major steps to
 *   aid observability: reads/writes, URL signing, and not-found conditions. Time complexity
 *   is O(1) for direct lookups and O(N) for list operations with linear post-processing.
 *
 * Responsibilities:
 *   1) Read one snapshot’s metadata for a (docId, snapshotId) pair.
 *   2) List snapshot metadata (optionally filtered by mapId), ordered by ts desc.
 *   3) List all snapshot metadata for a document, returned as normalized objects.
 *   4) Create/persist a new snapshot metadata record for a document.
 *   5) Generate signed READ/WRITE URLs for Cloud Storage objects, with a default TTL.
 *   6) Normalize Firestore Timestamps into ISO-8601 strings for the API layer.
 ***********************************************************************************************/

import admin from 'firebase-admin';
import { firestore } from '@/app/src/services/firebase';

/** ********************************************************************************************
 * @type SnapshotMeta
 * @purpose
 *   Normalized metadata shape that API endpoints use and return. Timestamps are ISO strings
 *   for transport friendliness. All fields are explicit to avoid runtime ambiguity.
 *********************************************************************************************/
export interface SnapshotMeta {
  snapshotId: string;
  mapId?: string;
  title?: string;
  ts: string;           // ISO timestamp
  author: string;
  size: number;
  path: string;         // GCS object path, e.g. "snapshots/{docId}/{snapshotId}.bloomdocx.zip"
  docId?: string;       // stored for convenience by the caller; optional in reads
}

/** ********************************************************************************************
 * @function toSnapshotMeta
 * @description
 *   Converts a Firestore document snapshot into a normalized SnapshotMeta object. Ensures that
 *   the Firestore Timestamp is transformed into an ISO string, and that the document ID is
 *   always used as the snapshotId. Fields that are not present are defaulted to reasonable
 *   values to avoid undefined checks elsewhere. This function is intentionally small and pure
 *   to keep the adapter predictable and easily testable in isolation.
 *********************************************************************************************/
function toSnapshotMeta(docId: string, doc: admin.firestore.DocumentSnapshot): SnapshotMeta {
  const data = doc.data() || {};
  const ts = (data.ts && typeof (data.ts as any).toDate === 'function')
    ? (data.ts as admin.firestore.Timestamp).toDate().toISOString()
    : new Date(0).toISOString();

  return {
    snapshotId: doc.id,
    mapId: data.mapId,
    title: data.title,
    ts,
    author: data.author || 'unknown',
    size: typeof data.size === 'number' ? data.size : 0,
    path: data.path || '',
    docId,
  };
}

/** ********************************************************************************************
 * @function requireNonEmpty
 * @description
 *   Asserts that a given string input is non-empty. Throws with a readable message if a required
 *   parameter is missing. This is used by signing helpers to ensure invalid paths do not proceed
 *   to GCS. Keeping this assertion internal to the adapter prevents ambiguous storage calls and
 *   yields clear error logs during development and operations.
 *********************************************************************************************/
function requireNonEmpty(name: string, value: string | undefined | null): string {
  const v = (value || '').trim();
  if (!v) {
    throw new Error(`VersionHistoryFB.ts requireNonEmpty 8001 › Missing required field: ${name}`);
  }
  return v;
}

/** ********************************************************************************************
 * @function getSnapshotMeta
 * @description
 *   Reads one snapshot metadata document from Firestore at
 *   `documents/{docId}/snapshots/{snapshotId}`. Returns `null` when the document does not exist.
 *   The function is O(1) and only touches Firestore once. Consumers can use the returned `path`
 *   field to request signed download URLs from `signSnapshotDownloadUrl`. Purposeful logging is
 *   included for tracing not-found vs. found cases without noisy verbosity.
 *********************************************************************************************/
export async function getSnapshotMeta(
  docId: string,
  snapshotId: string
): Promise<SnapshotMeta | null> {
  try {
    const ref = firestore.collection('documents').doc(docId).collection('snapshots').doc(snapshotId);
    const snap = await ref.get();

    if (!snap.exists) {
      console.log('VersionHistoryFB.ts 8002 › getSnapshotMeta not found', { docId, snapshotId });
      return null;
    }

    const meta = toSnapshotMeta(docId, snap);
    console.log('VersionHistoryFB.ts 8003 › getSnapshotMeta found', { docId, snapshotId, hasPath: !!meta.path });
    return meta;
  } catch (err) {
    console.error('VersionHistoryFB.ts 8004 › getSnapshotMeta error', { docId, snapshotId, err });
    throw err;
  }
}

/** ********************************************************************************************
 * @function listSnapshots
 * @description
 *   Lists snapshot metadata for a document, optionally filtered by `mapId`. The results are
 *   ordered by timestamp descending, returned as normalized `SnapshotMeta[]`. Complexity is O(N)
 *   over the number of matching snapshots. This function does not apply any additional business
 *   rules; “deleted mode” grouping remains in the endpoint to keep the adapter single-purpose.
 *********************************************************************************************/
export async function listSnapshots(
  docId: string,
  opts?: { mapId?: string }
): Promise<SnapshotMeta[]> {
  try {
    let query: admin.firestore.Query = firestore
      .collection('documents')
      .doc(docId)
      .collection('snapshots');

    // 1) Optional filter by mapId for targeted views
    if (opts?.mapId) {
      query = query.where('mapId', '==', opts.mapId);
    }

    // 2) Order by timestamp descending for UX-friendly lists
    query = query.orderBy('ts', 'desc');

    // 3) Execute and normalize
    const snap = await query.get();
    const rows = snap.docs.map(d => toSnapshotMeta(docId, d));
    console.log('VersionHistoryFB.ts 8005 › listSnapshots fetched', { docId, count: rows.length, filtered: !!opts?.mapId });
    return rows;
  } catch (err) {
    console.error('VersionHistoryFB.ts 8006 › listSnapshots error', { docId, mapId: opts?.mapId, err });
    throw err;
  }
}

/** ********************************************************************************************
 * @function listAllSnapshots
 * @description
 *   Retrieves **all** snapshot documents for a given `docId`. This is used by the “deleted mode”
 *   flow in the endpoint, where grouping and filtering by liveness is performed in-memory. The
 *   adapter only returns normalized rows and does not enforce domain logic. Complexity is O(N)
 *   over the number of snapshot documents under the target sub-collection.
 *********************************************************************************************/
export async function listAllSnapshots(docId: string): Promise<SnapshotMeta[]> {
  try {
    const query = firestore.collection('documents').doc(docId).collection('snapshots');
    const snap = await query.get();
    const rows = snap.docs.map(d => toSnapshotMeta(docId, d));
    console.log('VersionHistoryFB.ts 8007 › listAllSnapshots fetched', { docId, count: rows.length });
    return rows;
  } catch (err) {
    console.error('VersionHistoryFB.ts 8008 › listAllSnapshots error', { docId, err });
    throw err;
  }
}

/** ********************************************************************************************
 * @function createSnapshotMeta
 * @description
 *   Persists a snapshot metadata record under `documents/{docId}/snapshots/{snapshotId}`. When
 *   `ts` is not provided, the current server time is used. This call is O(1) and is designed to
 *   be invoked after an upload URL is minted, allowing the list endpoints to surface the new
 *   entry immediately. The function validates critical fields (path, author, snapshotId) to
 *   avoid partial or inconsistent state in Firestore.
 *********************************************************************************************/
export async function createSnapshotMeta(args: {
  docId: string;
  snapshotId: string;
  path: string;
  author: string;
  title?: string;
  mapId?: string;
  size?: number;
  ts?: admin.firestore.Timestamp;
}): Promise<void> {
  const { docId, snapshotId } = args;

  // 1) Validate critical inputs up-front
  requireNonEmpty('docId', docId);
  requireNonEmpty('snapshotId', snapshotId);
  requireNonEmpty('path', args.path);
  requireNonEmpty('author', args.author);

  try {
    // 2) Compute the write target and payload
    const ref = firestore.collection('documents').doc(docId).collection('snapshots').doc(snapshotId);
    const payload = {
      docId,
      mapId: args.mapId || null,
      title: args.title || null,
      snapshotId,
      path: args.path,
      author: args.author,
      ts: args.ts || admin.firestore.Timestamp.now(),
      size: typeof args.size === 'number' ? args.size : 0,
    };

    // 3) Persist
    await ref.set(payload, { merge: true });
    console.log('VersionHistoryFB.ts 8009 › createSnapshotMeta saved', { docId, snapshotId, path: args.path });
  } catch (err) {
    console.error('VersionHistoryFB.ts 8010 › createSnapshotMeta error', { docId, snapshotId, err });
    throw err;
  }
}

/** ********************************************************************************************
 * @function signSnapshotUploadUrl
 * @description
 *   Mints a V4 signed **WRITE** URL for a GCS object at the supplied `path`. Default TTL is
 *   5 minutes (configurable). The Content-Type is required by GCS signing for uploads and
 *   defaults to `application/octet-stream`. Complexity is O(1). Consumers receive a plain
 *   object containing the `uploadUrl`. The function logs the path and TTL used to assist in
 *   debugging and support investigations without leaking credentials in logs.
 *********************************************************************************************/
export async function signSnapshotUploadUrl(
  path: string,
  ttlMs: number = 5 * 60 * 1000,
  contentType: string = 'application/octet-stream'
): Promise<{ uploadUrl: string }> {
  const objectPath = requireNonEmpty('path', path);
  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(objectPath);
    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + ttlMs,
      contentType,
    });
    console.log('VersionHistoryFB.ts 8011 › signSnapshotUploadUrl issued', { path: objectPath, ttlMs });
    return { uploadUrl };
  } catch (err) {
    console.error('VersionHistoryFB.ts 8012 › signSnapshotUploadUrl error', { path: objectPath, err });
    throw err;
  }
}

/** ********************************************************************************************
 * @function signSnapshotDownloadUrl
 * @description
 *   Mints a V4 signed **READ** URL for a GCS object at `path` with a default TTL of 5 minutes.
 *   Complexity is O(1). The function returns a plain object containing `downloadUrl`. Logging
 *   is limited to path and TTL to preserve security while allowing operators to diagnose any
 *   issues around signing or access without dumping credentials or headers.
 *********************************************************************************************/
export async function signSnapshotDownloadUrl(
  path: string,
  ttlMs: number = 5 * 60 * 1000
): Promise<{ downloadUrl: string }> {
  const objectPath = requireNonEmpty('path', path);
  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(objectPath);
    const [downloadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + ttlMs,
    });
    console.log('VersionHistoryFB.ts 8013 › signSnapshotDownloadUrl issued', { path: objectPath, ttlMs });
    return { downloadUrl };
  } catch (err) {
    console.error('VersionHistoryFB.ts 8014 › signSnapshotDownloadUrl error', { path: objectPath, err });
    throw err;
  }
}
