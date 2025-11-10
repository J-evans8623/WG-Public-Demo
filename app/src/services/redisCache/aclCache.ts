// lib/aclCache.ts

/***************************************************************************************************
 * @file lib/aclCache.ts
 * @description
 *   This module centralizes all ACL-specific caching concerns and exposes a compact API that is
 *   easy to integrate from service and route layers. Its primary responsibilities are:
 *   (1) provide a monotonic, per-document ACL version counter that readers consult and writers bump,
 *   (2) serve normalized ACL snapshots through a cache-aside path that avoids thundering herds,
 *   (3) cache derived, per-user roles (Owner/Editor/Viewer/None) keyed by the current ACL version,
 *   and (4) offer concise, purpose-driven logging for observability in production.
 *
 *   The design is deliberately **non-authoritative**. Firestore remains the system of record; this
 *   cache only accelerates reads and reduces Firestore amplification under steady load. Precise
 *   invalidation is achieved with a single `INCR` on the per-doc version key whenever any ACL
 *   mutation succeeds. Readers include the current version in their keys, so they transparently
 *   stop hitting stale keys after a write. All operations are O(1) string ops or single-key Redis
 *   commands; network latency dominates. Keys are namespaced in lib/cacheKeys.ts for consistency.
 *
 *   Functions are written to accept generic loaders/computations to avoid circular imports. Callers
 *   provide the Firestore loader (for snapshots) or a pure function (for role computation). The
 *   helpers add short negative caching for “doc not found” scenarios to prevent request storms. The
 *   module is safe under Redis outages: readers can bypass cache by setting skipCache at call sites
 *   if necessary, and now also benefit from built-in fail-open semantics in this file itself. That
 *   means ACL checks used by authenticated Next.js endpoints (which first call authenticateRequest
 *   to verify the session before checking permissions) will remain correct and available even when
 *   Redis is degraded, trading extra Firestore load for higher reliability and consistent behavior.
 ***************************************************************************************************/

import type Redis from 'ioredis';
import { getRedis } from './redis';
import { cacheAside } from './cacheAside';
import { CACHE_TTL, NEGATIVE_TTL } from './cachePolicies';
import { aclVersionKey, aclSnapshotKey, roleKey } from './cacheKeys';

export type Role = 'Owner' | 'Editor' | 'Viewer' | 'None';

export interface AclSnapshot {
  docExists: boolean;
  ownerId: string;
  editors: string[];
  sharedWith: string[];
  publicEdit: boolean;
  publicView: boolean;
}

/**
 * getAclVersion
 * @description
 *   Returns the current ACL version for a document. If no version exists yet, falls back to 0 so
 *   the first bump moves 0→1. This read is O(1) and cheap; the value is inserted into cache keys
 *   for precise invalidation. On Redis errors, the function logs a warning and returns 0, ensuring
 *   that version resolution never causes ACL checks to fail and instead gracefully degrades caching.
 */
export async function getAclVersion(docId: string): Promise<number> { // update - 21
  const client: Redis = getRedis();
  try {
    // (1) Read the version key directly from Redis as a string.
    const v = await client.get(aclVersionKey(docId));

    // (2) Coerce to a non-negative, finite number, defaulting to 0 when missing/invalid.
    const ver = v ? Number(v) : 0; // ← default 0 so first bump moves 0→1
    const safe = Number.isFinite(ver) && ver >= 0 ? ver : 0;

    // (3) Log the resolved version for observability, then return the safe value.
    console.log('lib/aclCache.ts [6401] getAclVersion', { docId, ver: safe });
    return safe;
  } catch (e) {
    // (4) Fail-open: log the error and return 0 so ACL consumers keep working without versioning.
    console.warn('lib/aclCache.ts [6400] getAclVersion fail-open', {
      docId,
      err: (e as Error)?.message,
    });
    return 0;
  }
}

/**
 * bumpAclVersion
 * @description
 *   Atomically increments the ACL version for a document. Writers call this **after** a successful
 *   Firestore mutation that changes public flags or editor lists. Readers automatically shift to
 *   fresh keys on their next request since the version is embedded in cache key names. Increments
 *   remain O(1) operations against Redis; any errors propagate so callers can decide whether failed
 *   version bumps should influence their own error handling or be treated as non-fatal conditions.
 */
export async function bumpAclVersion(docId: string): Promise<number> {
  const client: Redis = getRedis();
  const key = aclVersionKey(docId);
  const ver = await client.incr(key);
  console.log('lib/aclCache.ts [6402] bumpAclVersion', { docId, key, ver });
  return ver;
}

/**
 * readAclSnapshot
 * @description
 *   Returns a normalized ACL snapshot for a document via a cache-aside flow. Callers must supply
 *   a loader that reads Firestore and returns the canonical shape. Negative caching is applied on
 *   “missing doc” responses to suppress storms; TTLs are defined in cachePolicies. If the cache
 *   path fails (for example, due to Redis outages or serialization errors), this helper logs the
 *   failure and **fails open** by invoking the Firestore loader directly, ensuring ACL checks still
 *   operate correctly even when the cache is unavailable or intermittently misbehaving.
 */
export async function readAclSnapshot( // update - 22
  docId: string,
  loader: () => Promise<AclSnapshot | null>
): Promise<AclSnapshot | null> {
  // (1) Resolve the current ACL version and compute the versioned snapshot key.
  const ver = await getAclVersion(docId);
  const key = aclSnapshotKey(ver, docId);

  // (2) Wrap the authoritative loader to normalize nullish results and add structured logging.
  const wrapped = async (): Promise<AclSnapshot | null> => {
    // (2.1) Execute the Firestore-backed loader.
    const snap = await loader();

    // (2.2) When the loader returns null, treat as a negative-cache candidate.
    if (!snap) {
      console.log('lib/aclCache.ts [6404] snapshot loader→NEG', { docId, ver });
      return null;
    }

    // (2.3) On a concrete snapshot, log high-level ACL posture for observability.
    console.log('lib/aclCache.ts [6405] snapshot loader→OK', {
      docId,
      ver,
      ownerId: snap.ownerId,
      editorsCount: snap.editors.length,
      sharedCount: snap.sharedWith.length,
      publicEdit: snap.publicEdit,
      publicView: snap.publicView,
    });

    return snap;
  };

  // (3) Attempt to read via cacheAside, mirroring the docCache.ts fail-open pattern.
  try {
    const hit = await cacheAside<AclSnapshot>(
      key,
      CACHE_TTL.ACL_SNAPSHOT,
      wrapped,
      { negativeTtlSec: NEGATIVE_TTL.DEFAULT }
    );

    // (3.1) Log whether we hit a negative sentinel or a concrete cached snapshot.
    if (hit == null) {
      console.log('lib/aclCache.ts [6406] snapshot NEG hit', { docId, ver, key });
    } else {
      console.log('lib/aclCache.ts [6407] snapshot HIT/SET', { docId, ver, key });
    }

    // (3.2) Return the cached/loaded snapshot to the caller.
    return hit;
  } catch (e) {
    // (4) On cache path failure, fail open to the authoritative loader.
    const msg = (e as Error)?.message ?? String(e);
    console.warn('lib/aclCache.ts [6408] snapshot cache path failed, falling back to loader', {
      docId,
      ver,
      key,
      err: msg,
    });

    // (4.1) Call the wrapped loader directly without touching Redis again.
    const fresh = await wrapped();

    // (4.2) Return the fresh snapshot (or null) as the best-effort ACL view.
    return fresh;
  }
}

/**
 * readRole
 * @description
 *   Returns an effective role (Owner/Editor/Viewer/None) for (docId, email) derived from the
 *   current ACL version. Callers provide a compute function that deterministically maps an
 *   ACL snapshot plus email to a Role. Roles are cached briefly to cut recomputation. If the
 *   cache path fails due to Redis or serialization issues, the helper logs the failure and
 *   falls back to the compute function directly, ensuring ACL-based access decisions remain
 *   correct even when the cache is unhealthy, while keeping Redis operations O(1) when present.
 */
export async function readRole( // update - 23
  docId: string,
  email: string,
  compute: () => Promise<Role>
): Promise<Role> {
  // (1) Resolve the current ACL version and compute the versioned role key.
  const ver = await getAclVersion(docId);
  const key = roleKey(ver, docId, email);

  // (2) Wrap the compute function to add logging while preserving deterministic role behavior.
  const wrapped = async (): Promise<Role> => {
    // (2.1) Compute the effective role using the caller-provided function.
    const r = await compute();

    // (2.2) Log the computed role for observability.
    console.log('lib/aclCache.ts [6409] role compute→OK', { docId, email, ver, role: r });
    return r;
  };

  // (3) Attempt to compute via cacheAside with fail-open semantics.
  try {
    const role = await cacheAside<Role>(
      key,
      CACHE_TTL.ROLE_RESULT,
      wrapped,
      { negativeTtlSec: NEGATIVE_TTL.DEFAULT }
    );

    // (3.1) cacheAside returns null only if a negative sentinel were written. For roles, we
    //       always coerce null to 'None' to keep downstream logic simple and safe.
    const finalRole = (role ?? 'None') as Role;
    console.log('lib/aclCache.ts [6403] readRole', { docId, email, role: finalRole, ver });
    return finalRole;
  } catch (e) {
    // (4) On cache path failure, log and fall back to a direct compute().
    const msg = (e as Error)?.message ?? String(e);
    console.warn('lib/aclCache.ts [6410] role cache path failed, falling back to compute', {
      docId,
      email,
      ver,
      key,
      err: msg,
    });

    // (4.1) Compute the role directly without involving Redis again.
    const fresh = await wrapped();

    // (4.2) Coerce any unexpected nullish values to 'None' as a defensive default.
    const finalRole = (fresh ?? 'None') as Role;
    console.log('lib/aclCache.ts [6411] readRole fallback', { docId, email, role: finalRole, ver });
    return finalRole;
  }
}
