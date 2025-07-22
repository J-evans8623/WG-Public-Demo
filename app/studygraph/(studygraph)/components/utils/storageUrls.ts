/**
 * @file utils/storageUrls.ts
 * @description
 *   Client-side helper to fetch signed URLs for upload & download.
 *
 * Responsibilities:
 *   - getUploadUrl(docId, type)
 *   - getDownloadUrl(docId, type)
 */

export async function getUploadUrl(
  docFileID: string,
  type: 'doc' | 'chat'
): Promise<{ uploadUrl: string; fileStoragePath: string }> {
  console.log('storageUrls.ts 5001 › fetching upload URL', { docFileID, type });
  const params = new URLSearchParams({ docFileID, type });
  const res = await fetch(`/api/document/upload-url?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    console.error('storageUrls.ts 5002 › upload-url fetch failed', { status: res.status });
    throw new Error(`Upload URL error: ${res.statusText}`);
  }
  const payload = await res.json();
  console.log('storageUrls.ts 5003 › received upload URL', payload);
  return payload;
}

export async function getDownloadUrl(
  docFileID: string,
  type: 'doc' | 'chat'
): Promise<{ downloadUrl: string; fileStoragePath: string }> {
  console.log('storageUrls.ts 5004 › fetching download URL', { docFileID, type });
  const params = new URLSearchParams({ docFileID, type });
  const res = await fetch(`/api/document/download-url?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!res.ok) {
    console.error('storageUrls.ts 5005 › download-url fetch failed', { status: res.status });
    throw new Error(`Download URL error: ${res.statusText}`);
  }
  const payload = await res.json();
  console.log('storageUrls.ts 5006 › received download URL', payload);
  return payload;
}
