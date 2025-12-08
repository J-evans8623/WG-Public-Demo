// services/fileListCache.ts
/**
 * @file services/fileListCache.ts
 * @description
 *   This utility provides a concise, production-ready caching layer dedicated exclusively to
 *   the "file list metadata" returned by ApiContext’s list/refresh flows. It persists a single
 *   user-scoped value in localStorage with a very small schema, an absolute updatedAt timestamp,
 *   and a short TTL to prevent staleness across sessions. The design intentionally avoids any
 *   external dependencies and keeps the API surface area tiny: get, set, and clear. The cache
 *   key is derived from the normalized user email (or "guest") and a schema version to ensure
 *   safe forward migration if the data shape changes in the future. Each function is defensive:
 *   it gracefully handles JSON parse errors, corrupted entries, and unavailable storage without
 *   crashing the app. Logging focuses on key success/failure checkpoints for observability while
 *   keeping signals sparse. All operations are O(1) and are safe to call frequently.
 */

import type { UserFileMetadata } from '@/app/src/types/fileTypes';

type FileListShape = {
  ownedFiles: UserFileMetadata[];
  sharedFiles: UserFileMetadata[];
};

type CacheEnvelope = {
  schemaVersion: number;
  updatedAt: number; // epoch ms
  data: FileListShape;
};

const CACHE_PREFIX = '__file_list_cache__';
const SCHEMA_VERSION = 1;
const DEFAULT_TTL_MS = 86_400_000; // one day

/**
 * getCacheKey
 * Returns the stable cache key for a given normalized user key (email lowercased or "guest").
 * This keeps per-user isolation and allows safe multi-account usage on the same browser.
 */
function getCacheKey(userKey: string): string {
  return `${CACHE_PREFIX}:${userKey}:v${SCHEMA_VERSION}`;
}

/**
 * getFileListCache
 * Responsibility:
 *   Retrieve a user-scoped file list cache if it exists, schema matches, and TTL is valid.
 *   If the cache is expired, malformed, or unavailable, return null. This function is O(1)
 *   and never throws; all errors are swallowed and logged to avoid disrupting UI flows.
 */
export function getFileListCache(
  userKey: string,
  ttlMs: number = DEFAULT_TTL_MS
): FileListShape | null {
  try {
    const raw = localStorage.getItem(getCacheKey(userKey));
    if (!raw) {
      //console.log('[fileListCache.ts][5101] getFileListCache: miss (no entry)', { userKey });
      return null;
    }

    const parsed: CacheEnvelope = JSON.parse(raw);
    if (parsed?.schemaVersion !== SCHEMA_VERSION) {
 
      return null;
    }

    const age = Date.now() - parsed.updatedAt;
    if (age > ttlMs) {
      //console.log('[fileListCache.ts][5103] getFileListCache: expired', { userKey, age, ttlMs });
      return null;
    }

    if (
      !parsed?.data ||
      !Array.isArray(parsed.data.ownedFiles) ||
      !Array.isArray(parsed.data.sharedFiles)
    ) {
      //console.log('[fileListCache.ts][5104] getFileListCache: malformed data', { userKey });
      return null;
    }


    return parsed.data;
  } catch (e) {
    //console.warn('[fileListCache.ts][5191] getFileListCache: error (non-fatal)', e);
    return null;
  }
}

/**
 * setFileListCache
 * Responsibility:
 *   Persist a user-scoped file list snapshot into localStorage with the current schemaVersion
 *   and timestamp. Intended to be called after successful server fetches (write-through) and
 *   after local mutations are applied (maintain cache coherence). O(1) time; never throws.
 */
export function setFileListCache(userKey: string, data: FileListShape): void {
  try {
    const envelope: CacheEnvelope = {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: Date.now(),
      data,
    };
    localStorage.setItem(getCacheKey(userKey), JSON.stringify(envelope));

  } catch (e) {
    //console.warn('[fileListCache.ts][5192] setFileListCache: error (non-fatal)', e);
  }
}

/**
 * clearFileListCache
 * Responsibility:
 *   Remove the user-scoped cache entry (e.g., on sign out or user switch). This function is
 *   O(1) and safe to call even if the entry does not exist. It logs a concise line for trace.
 */
export function clearFileListCache(userKey: string): void {
  try {
    localStorage.removeItem(getCacheKey(userKey));
    //console.log('[fileListCache.ts][5107] clearFileListCache: cleared', { userKey });
  } catch (e) {
    //console.warn('[fileListCache.ts][5193] clearFileListCache: error (non-fatal)', e);
  }
}
