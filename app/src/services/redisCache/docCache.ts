// app/src/services/redisCache/docCache.ts
/***************************************************************************************************
 * @file app/src/services/redisCache/docCache.ts
 * @description
 *   This backend-only module implements a focused, generation-aware cache for Y.Doc bytes stored
 *   in Firebase Storage. Its single responsibility is to provide a fast, safe, and auto-invalidating
 *   read path for document bytes that are repeatedly consumed by internal services such as quiz
 *   generation. The cache key is derived from two inputs: the stable document identifier (docId)
 *   and the current **Storage object generation** reported by GCS metadata. Whenever a document is
 *   saved and Storage creates a new object generation, this module naturally computes a new key,
 *   guaranteeing perfect invalidation without explicit “bump” logic elsewhere. Data is stored in
 *   Redis as a Base64 string to ensure portability and avoid binary encoding pitfalls across
 *   infrastructure layers. The TTL policy favors a 2-hour window (phase-3 requirement) to cover
 *   bursty, iterative generations, and falls back to a very short TTL when generation is unknown,
 *   preventing thundering-herd behavior on first-time uploads. Observability is built-in via
 *   concise, location-tagged console logs. All operations are O(1) with respect to algorithmic
 *   complexity; network and IO latencies dominate overall time. This file never exports browser-
 *   usable code and must only be imported by backend modules.
 ***************************************************************************************************/

import { cacheAside } from '@/app/src/services/redisCache/cacheAside';
import { CACHE_TTL, NEGATIVE_TTL } from '@/app/src/services/redisCache/cachePolicies';
import { docBytesKey } from '@/app/src/services/redisCache/cacheKeys';
import { getLatestFileIdentifiers, loadDocumentFile } from '@/app/src/services/firebase';

/**
 * readDocBytesCached
 * @description
 *   Provides a generation-aware, cache-aside read for document bytes. Steps:
 *   (1) Fetch latest identifiers for the doc (path + storageGeneration). (2) Build a cache key
 *   using (docId, generation). (3) Attempt to read from Redis. (4) On miss, download bytes from
 *   Storage, encode to Base64 for portability, and write to Redis with a 2-hour TTL; if generation
 *   is unavailable, store under a "nog" key with a short TTL to avoid cache pinning. If Redis is
 *   down, the helper fails open by returning freshly downloaded bytes. Time complexity is O(1) for
 *   cache and key operations; the Storage download is the dominant cost.
 * @param docId - Stable document identifier.
 * @returns Uint8Array containing the Y.Doc update bytes.
 */
export async function readDocBytesCached(docId: string): Promise<Uint8Array> {
  // [Step 1] Resolve latest path + generation
  const latest = await getLatestFileIdentifiers(docId);
  const gen = latest.storageGeneration ?? 'nog';
  const ttl = gen === 'nog' ? 60 : CACHE_TTL.DOC_BYTES;
  const key = docBytesKey(docId, gen);
  // eslint-disable-next-line no-console
  console.log('docCache.ts 9301 › identifiers', { docId, path: latest.path, gen, ttl });

  // [Step 2] Cache-aside loader that returns a Base64 string or null
  const loader = async (): Promise<string | null> => {
    if (!latest.path) {
      // eslint-disable-next-line no-console
      console.warn('docCache.ts 9391 › no path available for doc', { docId });
      return null;
    }
    try {
      const buf = await loadDocumentFile(latest.path);
      const b64 = Buffer.from(buf).toString('base64');
      // eslint-disable-next-line no-console
      console.log('docCache.ts 9302 › storage download OK', { docId, path: latest.path, byteLength: buf?.byteLength ?? 0 });
      return b64;
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('docCache.ts 9392 › storage download failed', { docId, path: latest.path, err: e?.message || e });
      throw e;
    }
  };

  // [Step 3] Attempt cache read-through
  try {
    const b64 = await cacheAside<string>(key, ttl, loader, { negativeTtlSec: NEGATIVE_TTL.DEFAULT });
    if (!b64) {
      // eslint-disable-next-line no-console
      console.error('docCache.ts 9393 › DOC_NOT_FOUND via cacheAside', { docId, key });
      const err: any = new Error('DOC_NOT_FOUND');
      err.code = 'DOC_NOT_FOUND';
      throw err;
    }
    // eslint-disable-next-line no-console
    console.log('docCache.ts 9303 › cache hit', { docId, key, len: b64.length });
    return Uint8Array.from(Buffer.from(b64, 'base64'));
  } catch (e: any) {
    // [Step 4] Fail-open logic: if cache layer itself failed, try direct load once more
    const msg = String(e?.message || '');
    if (e?.code === 'DOC_NOT_FOUND') throw e;

    // eslint-disable-next-line no-console
    console.warn('docCache.ts 9394 › cache path failed, falling back to direct download', { docId, key, err: msg });
    if (!latest.path) {
      const nf: any = new Error('DOC_NOT_FOUND');
      nf.code = 'DOC_NOT_FOUND';
      throw nf;
    }
    const buf = await loadDocumentFile(latest.path);
    // eslint-disable-next-line no-console
    console.log('docCache.ts 9304 › fallback direct download OK', { docId, path: latest.path, byteLength: buf?.byteLength ?? 0 });
    return new Uint8Array(buf);
  }
}
