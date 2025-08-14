/**
 * @file utils/storageUrls.ts
 * @description
 *   Client-side helper to fetch signed URLs for upload & download.
 *
 * Responsibilities:
 *   - getUploadUrl(docId, type)
 *   - getDownloadUrl(docId, type)
 */


import type { AccessEnvelope } from '@/app/studygraph/(studygraph)/types/access';


type UploadOk = { uploadUrl: string; fileStoragePath: string };
type DownloadOk = { downloadUrl: string; fileStoragePath: string };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

export async function getUploadUrl(
  docFileID: string,
  type: 'doc' | 'chat'
): Promise<UploadOk> {
  console.log('storageUrls.ts › fetching upload URL', { docFileID, type });

  const params = new URLSearchParams({ docFileID, type });
  const res = await fetch(`/api/document/upload-urlv1?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Upload URL error: ${res.statusText}`);

  const raw = (await res.json()) as UploadOk;
  const { uploadUrl, fileStoragePath } = raw;

  if (!isNonEmptyString(uploadUrl) || !isNonEmptyString(fileStoragePath)) {
    console.error('storageUrls.ts › malformed upload-url payload', raw);
    throw new Error('Upload URL error: malformed payload');
  }
  return { uploadUrl, fileStoragePath };
}

export async function getDownloadUrl(
  docFileID: string,
  type: 'doc' | 'chat'
): Promise<DownloadOk> {
  console.log('storageUrls.ts › fetching download URL', { docFileID, type });

  const params = new URLSearchParams({ docFileID, type });
  const res = await fetch(`/api/document/download-urlv1?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Download URL error: ${res.statusText}`);

  const raw = (await res.json()) as DownloadOk;
  const { downloadUrl, fileStoragePath } = raw;

  if (!isNonEmptyString(downloadUrl) || !isNonEmptyString(fileStoragePath)) {
    console.error('storageUrls.ts › malformed download-url payload', raw);
    throw new Error('Download URL error: malformed payload');
  }
  return { downloadUrl, fileStoragePath };
}

export type InitialUploadResult = {
  doc: UploadOk;
  chat: UploadOk;
  access?: AccessEnvelope;
};

/**
 * Called ONLY by createNewDocument(). Triggers the new-doc branch that mints
 * both signed URLs up-front (doc + initialized chat).
 */
export async function initialUpload(docFileID: string): Promise<InitialUploadResult> {
  console.log('storageUrls.ts › initialUpload (newDoc bootstrap)', { docFileID });

  const params = new URLSearchParams({ docFileID, type: 'doc', newDoc: 'true' });
  const res = await fetch(`/api/document/upload-urlv1?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error || ''; } catch {}
    throw new Error(`Initial upload URL error: ${res.statusText}${detail ? ` (${detail})` : ''}`);
  }

  const raw = await res.json() as {
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
    console.error('storageUrls.ts › malformed initialUpload payload', raw);
    throw new Error('Initial upload URL error: malformed payload');
  }

  return {
    doc:  { uploadUrl: raw.uploadUrl,        fileStoragePath: raw.fileStoragePath },
    chat: { uploadUrl: raw.chatUploadUrl,    fileStoragePath: raw.chatFileStoragePath },
    access: raw.access,
  };
}