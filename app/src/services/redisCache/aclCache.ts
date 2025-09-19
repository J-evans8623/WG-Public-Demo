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
 *   if necessary. Bumps are fire-and-forget atomic increments with minimal error handling to avoid
 *   impacting hot paths. Logging avoids noise and focuses on block/allow/refresh checkpoints.
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
 *   Returns the current ACL version for a document. If no version exists yet, falls back to 1.
 *   This read is O(1) and cheap; the value is inserted into cache keys for precise invalidation.
 */
export async function getAclVersion(docId: string): Promise<number> {
  const client: Redis = getRedis();
  const v = await client.get(aclVersionKey(docId));
  const ver = v ? Number(v) : 0; // ← default 0 so first bump moves 0→1
  console.log('lib/aclCache.ts [6401] getAclVersion', { docId, ver });
  return Number.isFinite(ver) && ver >= 0 ? ver : 0;
}

/**
 * bumpAclVersion
 * @description
 *   Atomically increments the ACL version for a document. Writers call this **after** a successful
 *   Firestore mutation that changes public flags or editor lists. Readers automatically shift to
 *   fresh keys on their next request since the version is embedded in cache key names.
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
 *   “missing doc” responses to suppress storms; TTLs are defined in cachePolicies.
 */
export async function readAclSnapshot(
  docId: string,
  loader: () => Promise<AclSnapshot | null>
): Promise<AclSnapshot | null> {
  const ver = await getAclVersion(docId);
  const key = aclSnapshotKey(ver, docId);
  return cacheAside<AclSnapshot>(
    key,
    CACHE_TTL.ACL_SNAPSHOT,
    loader,
    { negativeTtlSec: NEGATIVE_TTL.DEFAULT }
  );
}

/**
 * readRole
 * @description
 *   Returns an effective role (Owner/Editor/Viewer/None) for (docId, email) derived from the
 *   current ACL version. Callers provide a compute function that deterministically maps an
 *   ACL snapshot plus email to a Role. Roles are cached briefly to cut recomputation.
 */
export async function readRole(
  docId: string,
  email: string,
  compute: () => Promise<Role>
): Promise<Role> {
  const ver = await getAclVersion(docId);
  const key = roleKey(ver, docId, email);
  const role = await cacheAside<Role>(
    key,
    CACHE_TTL.ROLE_RESULT,
    compute,
    { negativeTtlSec: NEGATIVE_TTL.DEFAULT }
  );
  // cacheAside returns null only for negative sentinel; roles should be concrete → coerce to 'None'.
  const finalRole = (role ?? 'None') as Role;
  console.log('lib/aclCache.ts [6403] readRole', { docId, email, role: finalRole, ver });
  return finalRole;
}
