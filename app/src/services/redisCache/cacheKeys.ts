// lib/cacheKeys.ts
/***************************************************************************************************
 * @file lib/cacheKeys.ts
 * @description
 *   Canonical key-builder utilities for the cache and rate-gate layers. Keys are structured with
 *   human-readable namespaces so operational debugging is straightforward (i.e., being able to
 *   spot families of keys with a simple SCAN-like inspection in dev). Versioned keys are supported
 *   by embedding monotonically increasing version numbers in the name; write operations only need
 *   to increment the version counter, and readers automatically shift to the fresh names. This makes
 *   invalidation O(1) regardless of how many reader keys exist. All functions are O(1) string ops.
 *
 * Responsibilities:
 *   - Provide strongly-typed, collision-resistant key strings for each data class.
 *   - Encode versioned semantics directly into the key structure.
 *   - Include helpers for rate gates (fixed window and token bucket).
 ***************************************************************************************************/

function normId(s: string) { return String(s || '').trim().toLowerCase(); }

// 1) ACL version/cached data -----------------------------------------------------------------------
export const aclVersionKey = (docId: string) => `acl:v:${normId(docId)}`;
export const aclSnapshotKey = (ver: number | string, docId: string) =>
  `acl:snap:${ver}:${normId(docId)}`;
export const roleKey = (ver: number | string, docId: string, email: string) =>
  `role:${ver}:${normId(docId)}:${normId(email)}`;

// 2) User version/cached data ----------------------------------------------------------------------
export const userVersionKey = (email: string) => `user:v:${normId(email)}`;
export const userProfileKey = (ver: number | string, email: string) =>
  `user:profile:${ver}:${normId(email)}`;
export const userUsageKey = (ver: number | string, email: string) =>
  `user:usage:${ver}:${normId(email)}`;
export const validationResultKey = (ver: number | string, service: string, email: string) =>
  `user:validation:${normId(service)}:${ver}:${normId(email)}`;

// 3) Rate gate keys --------------------------------------------------------------------------------
export const gateFixedWindowKey = (service: string, subject: string, windowEpochSec: number, windowSec: number) =>
  `gate:fw:${normId(service)}:${normId(subject)}:${windowEpochSec}-${windowSec}`;

export const gateTokenBucketKey = (service: string, subject: string) =>
  `gate:tb:${normId(service)}:${normId(subject)}`;
export const docBytesKey = (docId: string, gen: string | number) =>
  // update - 1
  `doc:bytes:${normId(docId)}:${String(gen)}`;