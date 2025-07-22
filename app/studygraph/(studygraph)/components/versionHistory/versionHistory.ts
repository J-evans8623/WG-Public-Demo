/***********************************************************************************************
 * @file versionHistory.ts
 * @description
 *   Client-side service for taking per-map version snapshots in Bloom-Maps’ Version-History.
 *   It coordinates with the `/api/history/snapshot` guard endpoint to enforce rate limits,
 *   then uploads the lightweight “sub-doc” update produced by `extractSubDoc`. By isolating
 *   each concept map’s Yjs state, this avoids re-uploading the entire document on every snapshot.
 *   Console logs with unique 4-digit codes trace the flow: guard acquisition, update creation,
 *   and upload result. This module is strictly additive and does not alter the existing
 *   autosave logic.
 *
 * Responsibilities:
 *   - Expose `takeMapSnapshot` for front-end components.
 *   - Call the guard endpoint `/api/history/snapshot?docId=…` to obtain signed PUT URL.
 *   - Delegate sub-doc extraction to `extractSubDoc`.
 *   - Perform the PUT of the binary update.
 *   - Surface the `snapshotId` for UI integration.
 *
 * @author
 * @date
 ***********************************************************************************************/
// versionHistory.ts
/***********************************************************************************************
 * @file versionHistory.ts
 * …
 ***********************************************************************************************/
import * as Y from 'yjs';
import { extractSubDoc } from './subDocExtractor';

interface SnapshotGuardResponse {
  snapshotId: string;
  path: string;
  uploadUrl: string;
}


interface ConceptMapEntry {
  id: string;
  title: string;
  createdAt: string;
}

export function getMapTitle(ydoc: Y.Doc, mapId: string): string {
  const lessonModule = ydoc.getMap('lessonModule');

  // toJSON() gives you a plain { title: string; conceptMaps: ConceptMapEntry[] }
  const json = lessonModule.toJSON() as {
    title?: string;
    conceptMaps?: ConceptMapEntry[];
  };

  const maps = json.conceptMaps ?? [];
  const entry = maps.find(cm => cm.id === mapId);
  return entry?.title ?? 'Untitled Map';
}

export async function takeMapSnapshot(
  ydoc: Y.Doc,
  docId: string,
  mapId: string
): Promise<string> {
  console.log('versionHistory.ts 6007 › takeMapSnapshot start', { docId, mapId });
  const title = getMapTitle(ydoc, mapId);
  // 1) Acquire signed PUT URL
  const guardRes = await fetch(`/api/history/snapshot?docId=${encodeURIComponent(docId)}` + `&mapId=${encodeURIComponent(mapId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title })
  });

  if (!guardRes.ok) {
    // only silently skip on 429, propagate all other errors
    if (guardRes.status === 429) {
      console.warn('versionHistory.ts 6007 › Rate limit, skipping snapshot');
      const e: any = new Error('RateLimited');
      e.isRateLimit = true;
      throw e;
    }
    const text = await guardRes.text();
    console.error('versionHistory.ts 6007 › Guard request failed', guardRes.status, text);
    throw new Error(`Snapshot guard failed: ${guardRes.statusText}`);
  }

  const guard: SnapshotGuardResponse = await guardRes.json();
  console.log('versionHistory.ts 6007 › Guard acquired', guard.snapshotId, guard.uploadUrl);

  // 2) Build sub-doc update
  const update = extractSubDoc(ydoc, mapId);
  console.log('versionHistory.ts 6007 › Sub-doc update built, byteLength=', update.byteLength);

  // 3) Upload the update
  const putRes = await fetch(guard.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: update
  });

  if (!putRes.ok) {
    const text = await putRes.text();
    console.error('versionHistory.ts 6007 › Upload failed', putRes.status, text);
    throw new Error(`Snapshot upload failed: ${putRes.statusText}`);
  }

  console.log('versionHistory.ts 6007 › Upload succeeded for snapshotId=', guard.snapshotId);
  return guard.snapshotId;
}
