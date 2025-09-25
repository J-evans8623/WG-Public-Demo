/*****************************************************************************************
 * @file localCacheStore.ts
 * @description
 *   Production-ready front-end cache utility for Bloom Maps document sessions. This module
 *   centralizes two responsibilities critical to Phase 1–3 orchestration:
 *   (1) Persisting and retrieving authoritative persistence identifiers per document
 *       (storageGeneration and versionNumber) to support conditional uploads and robust
 *       conflict-avoidance; and
 *   (2) Storing raw document bytes in the browser to enable “time to first usable canvas”
 *       optimizations by rendering from cache before network reconciliation completes.
 *
 *   Identifiers are stored in localStorage using a compact JSON index to avoid quota
 *   pressure and enable O(1) lookup. Document bytes are stored in IndexedDB (with an
 *   in-memory fallback for environments lacking IDB). To keep storage steady for heavy
 *   users, a tiny eviction policy prunes the oldest cached entries beyond a small,
 *   configurable cap (default 10 docs). All operations are carefully logged at key
 *   checkpoints to aid observability while avoiding noisy console output.
 *
 *   This module is intentionally UI-agnostic and depends on no frameworks. Consumers are
 *   expected to call `saveDocBytes` after successful loads/saves, use `getPreconditions`
 *   during save attempts, and call `deleteDocBytes` + `clearDocIdentifiers` after deletes
 *   or permission removals. The public API favors O(1) access; eviction runs in O(k log k)
 *   relative to the number of cached docs and only triggers when the cap is exceeded.
 *
 * Responsibilities:
 *   - Maintain a local identifiers index (__doc_cache_index__) for conditional saves
 *   - Read/write/delete document bytes in IndexedDB with safe fallbacks
 *   - Provide a minimal, LRU-ish eviction to hold cache size under a fixed cap
 *   - Offer small utility helpers for docId parsing and LRU “touching”
 *****************************************************************************************/

/* =======================================================================================
 * Section 1 — Types and constants
 * =======================================================================================
 */

/** Index entry persisted in localStorage for fast lookups and LRU-ish aging. */
export type CacheIndexEntry = {
  lastAccessed: number;                                
  storageGeneration?: string | null;                   
  versionNumber?: number | null; 
   /** ID of the last viewed slide for this doc (optional, persisted). */
  lastViewedSlideId?: string | null;   
    lastViewedAt?: number | null;                   
};

/** The full index value stored at localStorage["__doc_cache_index__"]. */
export type CacheIndex = Record<string, CacheIndexEntry>; 

// IndexedDB configuration
const DB_NAME = 'bloom-doc-cache';                     
const STORE_NAME = 'bytes';                            
const DB_VERSION = 1;                                  

// LocalStorage key for the identifiers + LRU index
const INDEX_KEY = '__doc_cache_index__';               

// Default cap for tiny eviction policy (can be overridden per-call in saveDocBytes)
const DEFAULT_CAP = 10;                                

// In-memory fallback for environments where IDB is unavailable or fails
const inMemoryBytes = new Map<string, Uint8Array>();   

/* =======================================================================================
 * Section 2 — Internal: IndexedDB helpers
 * =======================================================================================
 */

/**
 * @function openDB
 * @description
 *   Opens (or creates) the IndexedDB database that stores document bytes. Ensures the
 *   object store exists. This function centralizes IDB access and returns a live database
 *   instance the caller must close. Intended to be used by the IDB wrappers below.
 *   Time complexity: O(1) for steady-state opens (amortized).
 */
function openDB(): Promise<IDBDatabase> {              
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
        console.log('[localCacheStore.ts][4001] onupgradeneeded: created store "bytes"'); 
      }
    };
    req.onsuccess = () => {
      console.log('[localCacheStore.ts][4002] openDB: success');             
      resolve(req.result);
    };
    req.onerror = () => {
      console.warn('[localCacheStore.ts][4003] openDB: error', req.error);   
      reject(req.error);
    };
  });
}

/**
 * @function idbPut
 * @description
 *   Puts a Uint8Array into the IDB store with the given key. Wraps the transaction
 *   lifecycle in a Promise. Time complexity: O(1).
 */
async function idbPut(key: string, value: Uint8Array): Promise<void> {       
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(value, key);
    tx.oncomplete = () => {
      console.log('[localCacheStore.ts][4004] idbPut: complete for key=', key); 
      resolve();
    };
    tx.onerror = () => {
      console.warn('[localCacheStore.ts][4005] idbPut: error', tx.error);    
      reject(tx.error);
    };
  });
  db.close();
}

/**
 * @function idbGet
 * @description
 *   Reads a value from IDB by key. Returns undefined if not found. Time complexity: O(1).
 */
async function idbGet<T = Uint8Array>(key: string): Promise<T | undefined> { 
  const db = await openDB();
  const out = await new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => {
      console.warn('[localCacheStore.ts][4006] idbGet: error', req.error);   
      reject(req.error);
    };
  });
  db.close();
  return out;
}

/**
 * @function idbDelete
 * @description
 *   Deletes a value from IDB by key. Performs a best-effort delete and resolves when the
 *   transaction completes. Time complexity: O(1).
 */
async function idbDelete(key: string): Promise<void> {                        
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
    tx.oncomplete = () => {
      console.log('[localCacheStore.ts][4007] idbDelete: complete for key=', key); 
      resolve();
    };
    tx.onerror = () => {
      console.warn('[localCacheStore.ts][4008] idbDelete: error', tx.error); 
      reject(tx.error);
    };
  });
  db.close();
}

/**
 * @function idbClearAll
 * @description
 *   Clears the entire object store. Use sparingly—primarily for logout or global resets.
 *   Time complexity: O(n) w.r.t. number of stored keys, but implemented efficiently by IDB.
 */
async function idbClearAll(): Promise<void> {                                 
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => {
      console.log('[localCacheStore.ts][4009] idbClearAll: complete');       
      resolve();
    };
    tx.onerror = () => {
      console.warn('[localCacheStore.ts][4010] idbClearAll: error', tx.error);
      reject(tx.error);
    };
  });
  db.close();
}

/* =======================================================================================
 * Section 3 — Internal: localStorage index helpers
 * =======================================================================================
 */

/**
 * @function getIndex
 * @description
 *   Loads the identifiers/LRU index from localStorage. Returns an empty object if not
 *   present or if parsing fails. Time complexity: O(1). Logs only on parse failure.
 */
export function getIndex(): CacheIndex {                                      
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as CacheIndex) : {};
  } catch (e) {
    console.warn('[localCacheStore.ts][4011] getIndex: parse error', e);      
    return {};
  }
}

/**
 * @function setIndex
 * @description
 *   Persists the full index back to localStorage. Time complexity: O(1).
 */
export function setIndex(idx: CacheIndex): void {                             
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(idx));
  } catch (e) {
    console.warn('[localCacheStore.ts][4012] setIndex: setItem failed', e);   
  }
}

/* =======================================================================================
 * Section 4 — Public API: Identifiers (preconditions) management
 * =======================================================================================
 */

/**
 * @function setDocIdentifiers
 * @description
 *   Upserts the authoritative identifiers for a document into the local index. These
 *   values (storageGeneration and versionNumber) are returned later by getPreconditions
 *   and used to perform conditional uploads. The function also updates the lastAccessed
 *   timestamp to keep the LRU-ish ordering fresh. Time complexity: O(1).
 */
export function setDocIdentifiers(                                             
  docId: string,
  ids: { storageGeneration: string | null; versionNumber: number | null; updatedAt?: number }
): void {
  const idx = getIndex();
  idx[docId] = {
    ...(idx[docId] || {}),
    storageGeneration: ids.storageGeneration ?? null,
    versionNumber: typeof ids.versionNumber === 'number' ? ids.versionNumber : null,
    lastAccessed: typeof ids.updatedAt === 'number' ? ids.updatedAt : Date.now(),
  };
  setIndex(idx);
  console.log('[localCacheStore.ts][4013] setDocIdentifiers: upserted docId=', docId); 
}

/**
 * @function getPreconditions
 * @description
 *   Returns the latest known identifiers in a ready-to-use shape for conditional uploads:
 *   `{ expectStorageGeneration, expectVersionNumber }`. If no entry exists, both fields
 *   are null. Time complexity: O(1). This function avoids throwing on missing data.
 */
export function getPreconditions(docId: string): {                             
  expectStorageGeneration: string | null;
  expectVersionNumber: number | null;
} {
  const idx = getIndex();
  const rec = idx[docId];
  return {
    expectStorageGeneration: rec?.storageGeneration ?? null,
    expectVersionNumber: rec?.versionNumber ?? null,
  };
}

/**
 * @function clearDocIdentifiers
 * @description
 *   Removes a single document’s identifiers from the local index. Prefer this over a
 *   full reset when deleting a single doc or when a user’s access is removed. Time
 *   complexity: O(1).
 */
export function clearDocIdentifiers(docId: string): void {                     
  const idx = getIndex();
  if (docId in idx) {
    delete idx[docId];
    setIndex(idx);
    console.log('[localCacheStore.ts][4014] clearDocIdentifiers: removed docId=', docId); 
  }
}

/**
 * @function clearAllIdentifiers
 * @description
 *   Clears the entire identifiers index. Use this during logout or catastrophic resets.
 *   Time complexity: O(1).
 */
export function clearAllIdentifiers(): void {                                  
  try {
    localStorage.removeItem(INDEX_KEY);
    console.log('[localCacheStore.ts][4015] clearAllIdentifiers: index cleared'); 
  } catch (e) {
    console.warn('[localCacheStore.ts][4016] clearAllIdentifiers: failed', e); 
  }
}

/* =======================================================================================
 * Section 5 — Public API: Cached bytes management + eviction
 * =======================================================================================
 */

/**
 * @function saveDocBytes
 * @description
 *   Persists document bytes to IndexedDB (preferred) with an in-memory fallback. Also
 *   updates the LRU-ish index and enforces the tiny eviction policy by pruning the
 *   oldest entries when the total exceeds a small cap (default 10). Time complexity:
 *   O(1) for the write, followed by O(k log k) only if cap is exceeded (k = number of
 *   cached docs). Eviction removes both bytes and index rows for pruned docs.
 */
export async function saveDocBytes(                                        
  docId: string,
  bytes: Uint8Array,
  cap: number = DEFAULT_CAP
): Promise<void> {
  try {
    if (typeof indexedDB !== 'undefined') {
      await idbPut(`doc:${docId}`, bytes);
    } else {
      inMemoryBytes.set(docId, bytes);
    }
    // Touch index (LRU-ish)
    const idx = getIndex();
    idx[docId] = { ...(idx[docId] || {}), lastAccessed: Date.now() };
    setIndex(idx);

    await pruneCache(cap);
    console.log('[localCacheStore.ts][4017] saveDocBytes: saved & pruned docId=', docId); 
  } catch (e) {
    console.warn('[localCacheStore.ts][4018] saveDocBytes: failed (non-fatal)', e); 
  }
}

/**
 * @function loadDocBytes
 * @description
 *   Loads document bytes from IndexedDB or from the in-memory fallback if IDB is
 *   unavailable. Returns null if no cached bytes exist. Does not fail loudly; it is
 *   safe to call during fast-boot rendering paths. Time complexity: O(1).
 */
export async function loadDocBytes(docId: string): Promise<Uint8Array | null> { 
  try {
    if (typeof indexedDB !== 'undefined') {
      const out = await idbGet<Uint8Array>(`doc:${docId}`);
      return out ?? null;
    }
    return inMemoryBytes.get(docId) ?? null;
  } catch (e) {
    console.warn('[localCacheStore.ts][4019] loadDocBytes: failed (non-fatal)', e); 
    return null;
  }
}

/**
 * @function deleteDocBytes
 * @description
 *   Deletes the cached bytes for a single document ID and removes any in-memory copy.
 *   Typically called after a server-side delete or when a user’s access is revoked.
 *   Time complexity: O(1).
 */
export async function deleteDocBytes(docId: string): Promise<void> {           
  try {
    if (typeof indexedDB !== 'undefined') {
      await idbDelete(`doc:${docId}`);
    }
    inMemoryBytes.delete(docId);
    console.log('[localCacheStore.ts][4020] deleteDocBytes: removed bytes for docId=', docId); 
  } catch (e) {
    console.warn('[localCacheStore.ts][4021] deleteDocBytes: failed (non-fatal)', e); 
  }
}

/**
 * @function clearAllBytes
 * @description
 *   Clears all cached bytes from IndexedDB and memory. Intended for logout or a “Reset
 *   cache” button. Time complexity: O(n) for the underlying IDB clear, but cheap in
 *   practice.
 */
export async function clearAllBytes(): Promise<void> {                         
  try {
    if (typeof indexedDB !== 'undefined') {
      await idbClearAll();
    }
    inMemoryBytes.clear();
    console.log('[localCacheStore.ts][4022] clearAllBytes: all bytes cleared'); 
  } catch (e) {
    console.warn('[localCacheStore.ts][4023] clearAllBytes: failed (non-fatal)', e); 
  }
}

/**
 * @function pruneCache
 * @description
 *   Enforces the tiny eviction cap by removing the least-recently-accessed docs from
 *   both the byte store and the identifiers index. The policy sorts by lastAccessed and
 *   deletes the oldest entries until the cache size is at or below the cap. Time
 *   complexity: O(k log k) for sorting where k is the number of cached docs.
 */
export async function pruneCache(cap: number = DEFAULT_CAP): Promise<void> {   
  const idx = getIndex();
  const ids = Object.keys(idx);
  if (ids.length <= cap) return;

  const sorted = ids.sort((a, b) => (idx[a].lastAccessed || 0) - (idx[b].lastAccessed || 0));
  const toRemove = sorted.slice(0, ids.length - cap);

  for (const docId of toRemove) {
    try {
      if (typeof indexedDB !== 'undefined') {
        await idbDelete(`doc:${docId}`);
      }
      inMemoryBytes.delete(docId);
      delete idx[docId];
    } catch (e) {
      console.warn('[localCacheStore.ts][4024] pruneCache: failed for docId=', docId, e); 
    }
  }
  setIndex(idx);
  console.log('[localCacheStore.ts][4025] pruneCache: removed', toRemove.length, 'docs'); 
}

/**
 * @function touchDocEntry
 * @description
 *   Updates the lastAccessed timestamp for a document in the identifiers index. Call
 *   this whenever you open/render a doc from cache so frequently used docs remain hot
 *   and unlikely to be evicted. Time complexity: O(1).
 */
export function touchDocEntry(docId: string): void {                           
  const idx = getIndex();
  if (idx[docId]) {
    idx[docId].lastAccessed = Date.now();
    setIndex(idx);
  }
}

/**
 * @function docIdFromStoragePath
 * @description
 *   Parses a storage path of the form "documents/{docId}.bloomdocx" and returns the
 *   extracted docId. If the format doesn’t match, returns the original string so
 *   callers can safely pass fileStorageId values. Time complexity: O(1).
 */
export function docIdFromStoragePath(fileStorageId: string): string {          
  const m = fileStorageId.match(/^documents\/(.+)\.bloomdocx$/);
  return m ? m[1] : fileStorageId;
}




/**
 * @function setLastViewedSlide (new)
 * @description
 *   Upsert the last viewed slide for a document into the existing index. O(1).
 *   We also refresh lastAccessed to keep this doc hot for the tiny LRU policy.
 *
 *   Steps:
 *    1) Load index (O(1)).
 *    2) Upsert { lastViewedSlideId, lastViewedAt, lastAccessed } under docId.
 *    3) Persist index (O(1)).
 */
export function setLastViewedSlide(docId: string, slideId: string, at?: number): void {
  // 1) Load index
  const idx = getIndex();

  // 2) Upsert fields on the per-doc row
  const now = typeof at === 'number' ? at : Date.now();
  idx[docId] = {
    ...(idx[docId] || {}),
    lastViewedSlideId: slideId,
    lastViewedAt: now,
    lastAccessed: now,
  };

  // 3) Save
  setIndex(idx);
  console.log('[localCacheStore.ts][4101] setLastViewedSlide (doc, slide, at)=', docId, slideId, now);
}


/**
 * @function getLastViewedSlide (new)
 * @description
 *   Returns the last viewed slideId for a given document from the index, or null. O(1).
 *
 *   Steps:
 *    1) Load index (O(1)).
 *    2) Read doc row; if missing or empty, return null.
 *    3) Return slide id or null.
 */
export function getLastViewedSlide(docId: string): string | null {
  // 1) Load
  const idx = getIndex();
  // 2) Read
  const rec = idx[docId];
  // 3) Return (normalize to null)
  return rec?.lastViewedSlideId ?? null;
}

/**
 * @function clearLastViewedSlide (new)
 * @description
 *   Removes only the "last viewed slide" fields for a document. Non-destructive to other fields. O(1).
 *
 *   Steps:
 *    1) Load index (O(1)).
 *    2) If doc row exists, delete only lastViewedSlideId/lastViewedAt.
 *    3) Persist index (O(1)).
 */
export function clearLastViewedSlide(docId: string): void {
  // 1) Load
  const idx = getIndex();
  // 2) Mutate row carefully
  if (idx[docId]) {
    delete idx[docId].lastViewedSlideId;
    delete idx[docId].lastViewedAt;
    setIndex(idx);
    console.log('[localCacheStore.ts][4102] clearLastViewedSlide (doc)=', docId);
  }
}