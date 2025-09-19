/**
 * @file utils/storageUrls.ts
 * @description
 *   Client-side utility module that centralizes calls to API endpoints responsible for
 *   minting signed Firebase Storage URLs and returning minimal access envelopes. By
 *   abstracting URL building and response normalization here, the rest of the front-end
 *   can request upload/download capabilities with a single function call and through a
 *   consistent shape. **Phase 3 update:** this module adds support for conflict-safe
 *   conditional uploads (via the upload API’s 409 response) and surfaces Storage/
 *   Firestore identifiers returned by the download and save flows where available so
 *   clients can update reconciliation markers (e.g., `metadata.persist.*`). Logging is
 *   lightweight and tagged with stable 4-digit codes to aid production troubleshooting
 *   without spamming the console. These helpers perform O(1) work; network latency
 *   dominates due to single API calls.
 *
 * Responsibilities:
 *   - getUploadUrl(docId, type, preconditions?) → issue a (conditionally) signed PUT URL.
 *   - getDownloadUrl(docId, type) → fetch a signed GET URL (and access envelope).
 *   - initialUpload(docId) → bootstrap flow: returns both doc and chat upload URLs.
 */

import type { AccessEnvelope } from '@/app/studygraph/(studygraph)/types/access';

type UploadOk = {
  uploadUrl: string;
  fileStoragePath: string;
};

type DownloadOk = {
  downloadUrl: string;
  fileStoragePath: string;
  access: AccessEnvelope;
  /** May be present if the server elects to return identifiers. */
  storageGeneration?: string | null;
  /** May be present if the server elects to return identifiers. */
  versionNumber?: number | null;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * @function getUploadUrl
 * @description
 *   Retrieves a signed upload URL for either a document or a per-user chat. When
 *   `preconditions` are provided, the server will verify the client’s expected
 *   identifiers and return HTTP 409 with authoritative `conflict` data if they do
 *   not match. The caller should catch that error and reconcile before retrying.
 *   Returns a normalized `{ uploadUrl, fileStoragePath }` shape on success.
 */
export async function getUploadUrl(
  docFileID: string,
  type: 'doc' | 'chat',
  preconditions?: { expectStorageGeneration?: string | number | null; expectVersionNumber?: number | null }
): Promise<UploadOk> {
  console.log('[storageUrls.ts][9301] › fetching upload URL', {
    docFileID,
    type,
    hasPre: !!preconditions,
  });

  const params = new URLSearchParams({ docFileID, type });
  if (preconditions?.expectStorageGeneration != null) {
    params.set('expectStorageGeneration', String(preconditions.expectStorageGeneration));
  }
  if (preconditions?.expectVersionNumber != null) {
    params.set('expectVersionNumber', String(preconditions.expectVersionNumber));
  }

  const res = await fetch(`/api/document/upload-urlv1?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });

  // Conflict path: surface parsed body to callers for reconciliation UX
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    console.warn('[storageUrls.ts][9302] › upload precondition conflict', body);
    const err = new Error('UPLOAD_PRECONDITION_FAILED');
    (err as any).code = 409;
    (err as any).body = body;
    throw err;
  }

  if (!res.ok) throw new Error(`Upload URL error: ${res.status} ${res.statusText}`);

  const raw = (await res.json()) as UploadOk;
  if (!isNonEmptyString(raw.uploadUrl) || !isNonEmptyString(raw.fileStoragePath)) {
    console.error('[storageUrls.ts][9303] › malformed upload-url payload', raw);
    throw new Error('Upload URL error: malformed payload');
    }
  return { uploadUrl: raw.uploadUrl, fileStoragePath: raw.fileStoragePath };
}

/**
 * @function getDownloadUrl
 * @description
 *   Retrieves a signed download URL for either a document or chat asset. The server
 *   also returns a normalized access envelope which the client can use to adjust its
 *   UI permissions immediately. Some server versions may additionally return storage
 *   and logical version identifiers; this function preserves them if present, defaulting
 *   to `null` otherwise to keep the return type predictable for callers.
 */
export async function getDownloadUrl(
  docFileID: string,
  type: 'doc' | 'chat'
): Promise<DownloadOk> {
  console.log('[storageUrls.ts][9304] › fetching download URL', { docFileID, type });

  const params = new URLSearchParams({ docFileID, type });
  const res = await fetch(`/api/document/download-urlv1?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Download URL error: ${res.status} ${res.statusText}`);

  const raw = (await res.json()) as DownloadOk;
  if (!isNonEmptyString(raw.downloadUrl) || !isNonEmptyString(raw.fileStoragePath)) {
    console.error('[storageUrls.ts][9305] › malformed download-url payload', raw);
    throw new Error('Download URL error: malformed payload');
  }
  return {
    downloadUrl: raw.downloadUrl,
    fileStoragePath: raw.fileStoragePath,
    access: raw.access,
    storageGeneration: raw.storageGeneration ?? null,
    versionNumber: typeof raw.versionNumber === 'number' ? raw.versionNumber : null,
  };
}

export type InitialUploadResult = {
  doc: UploadOk;
  chat: UploadOk;
  access?: AccessEnvelope;
};

/**
 * @function initialUpload
 * @description
 *   Triggers the new-document bootstrap path on the server which returns **both**
 *   signed URLs (document and per-user chat) in a single request. This is used by
 *   create flows where the client wants to immediately PUT bytes for the doc plus
 *   initialize a chat artifact. Returns normalized shapes so callers can PUT
 *   without additional mapping.
 */
export async function initialUpload(docFileID: string): Promise<InitialUploadResult> {
  console.log('[storageUrls.ts][9306] › initialUpload (newDoc bootstrap)', { docFileID });

  const params = new URLSearchParams({ docFileID, type: 'doc', newDoc: 'true' });
  const res = await fetch(`/api/document/upload-urlv1?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.error || '';
    } catch {
      /* ignore parse error for non-JSON bodies */
    }
    throw new Error(
      `Initial upload URL error: ${res.status} ${res.statusText}${detail ? ` (${detail})` : ''}`
    );
  }

  const raw = (await res.json()) as {
    uploadUrl: string;
    fileStoragePath: string;
    chatUploadUrl: string;
    chatFileStoragePath: string;
    access?: AccessEnvelope;
  };

  const ok =
    isNonEmptyString(raw.uploadUrl) &&
    isNonEmptyString(raw.fileStoragePath) &&
    isNonEmptyString(raw.chatUploadUrl) &&
    isNonEmptyString(raw.chatFileStoragePath);

  if (!ok) {
    console.error('[storageUrls.ts][9307] › malformed initialUpload payload', raw);
    throw new Error('Initial upload URL error: malformed payload');
  }

  return {
    doc: { uploadUrl: raw.uploadUrl, fileStoragePath: raw.fileStoragePath },
    chat: { uploadUrl: raw.chatUploadUrl, fileStoragePath: raw.chatFileStoragePath },
    access: raw.access,
  };
}
