/**
 * @file utils/storageUrls.ts
 * @description
 *   Client-side utility module that centralizes calls to API endpoints responsible for
 *   minting signed Firebase Storage URLs and returning minimal access envelopes.
 *
 *   Phase 3 + NP retry update:
 *     - Uses SupersedingCaller so rapid calls coalesce and in-flight minting is aborted.
 *     - Honors server 429 Retry-After exactly once; if deferred, we return `DEFERRED` so
 *       callers can noop or retry later based on UX.
 *     - Keeps the same shapes and 409 conflict surfacing.
 */

import type { AccessEnvelope } from '@/app/workspace/(studygraph)/types/access';
import { supersedingCall } from '@/app/src/net/SupersedingCaller';

type UploadOk = {
  uploadUrl: string;
  fileStoragePath: string;
};

type DownloadOk = {
  downloadUrl: string;
  fileStoragePath: string;
  access: AccessEnvelope;
  storageGeneration?: string | null;
  versionNumber?: number | null;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function deferredError(scope: string) {
  const err: any = new Error(`${scope}_DEFERRED`);
  err.deferred = true;
  err.scope = scope;
  return err;
}

/**
 * @function getUploadUrl
 * @description
 *   Retrieves a signed upload URL for either a document or a per-user chat.
 *   - On 429, the request is scheduled for retry; we return a DEFERRED error immediately.
 *   - On 409, we throw with { code:409, body } so callers can reconcile.
 *   - On success, returns { uploadUrl, fileStoragePath }.
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

  // Lane: per-doc + type + "upload-urlv1" (latest wins for the same doc/type)
  const lane = `storage:upload-urlv1:${type}:${docFileID}`;

  const makeRequest = async (signal: AbortSignal, payloadUnknown: unknown): Promise<Response> => {
    const p = (payloadUnknown as any) || {};
    const params = new URLSearchParams({ docFileID: p.docFileID, type: p.type });

    if (p.pre?.expectStorageGeneration != null) {
      params.set('expectStorageGeneration', String(p.pre.expectStorageGeneration));
    }
    if (p.pre?.expectVersionNumber != null) {
      params.set('expectVersionNumber', String(p.pre.expectVersionNumber));
    }
    if (p.newDoc) params.set('newDoc', 'true');

    return fetch(`/api/document/upload-urlv1?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
      signal,
    });
  };

  const payload = {
    docFileID,
    type,
    pre: preconditions ?? undefined,
    newDoc: false,
  };

  const res = await supersedingCall(lane, payload, makeRequest);

  // If we’re inside Retry-After, call returns null (timer scheduled).
  if (!res) throw deferredError('UPLOAD_URL');

  // Conflict: surface parsed body for reconciliation
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    console.warn('[storageUrls.ts][9302] › upload precondition conflict', body);
    const err: any = new Error('UPLOAD_PRECONDITION_FAILED');
    err.code = 409;
    err.body = body;
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
 *   Retrieves a signed download URL for either a document or chat asset.
 *   - On 429 (Retry-After), returns DEFERRED so caller can noop.
 *   - Returns optional identifiers for doc type when provided by server.
 */
export async function getDownloadUrl(
  docFileID: string,
  type: 'doc' | 'chat'
): Promise<DownloadOk> {
  console.log('[storageUrls.ts][9304] › fetching download URL', { docFileID, type });

  const lane = `storage:download-urlv1:${type}:${docFileID}`;

  const makeRequest = async (signal: AbortSignal, payloadUnknown: unknown): Promise<Response> => {
    const p = (payloadUnknown as any) || {};
    const params = new URLSearchParams({ docFileID: p.docFileID, type: p.type });
    return fetch(`/api/document/download-urlv1?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
      signal,
    });
  };

  const res = await supersedingCall(lane, { docFileID, type }, makeRequest);

  if (!res) throw deferredError('DOWNLOAD_URL');
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
 *   Bootstrap flow: mint **both** doc + chat upload URLs in one request.
 *   - Uses superseding lane so repeated bootstraps coalesce.
 *   - On 429, returns DEFERRED.
 */
export async function initialUpload(docFileID: string): Promise<InitialUploadResult> {
  console.log('[storageUrls.ts][9306] › initialUpload (newDoc bootstrap)', { docFileID });

  const lane = `storage:initial-upload:${docFileID}`;

  const makeRequest = async (signal: AbortSignal, payloadUnknown: unknown): Promise<Response> => {
    const p = (payloadUnknown as any) || {};
    const params = new URLSearchParams({ docFileID: p.docFileID, type: 'doc', newDoc: 'true' });
    return fetch(`/api/document/upload-urlv1?${params.toString()}`, {
      method: 'GET',
      credentials: 'include',
      signal,
    });
  };

  const res = await supersedingCall(lane, { docFileID }, makeRequest);

  if (!res) throw deferredError('INITIAL_UPLOAD');
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.error || '';
    } catch {/* ignore */}
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
