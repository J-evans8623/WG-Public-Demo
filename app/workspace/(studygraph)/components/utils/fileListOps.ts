// app/src/context/utils/fileListOps.ts

/***********************************************************************************************
 * @file app/src/context/utils/fileListOps.ts
 * @description
 *   This utility module centralizes **pure, side-effect-free** operations for maintaining the
 *   in-memory file list used by the homescreen. Its responsibilities are to:
 *   (1) Resolve the correct bucket (owned/shared) for a given record based on role/owner rules,
 *   (2) Normalize and compare `updatedAt` values safely (ISO coercion with fallbacks),
 *   (3) Insert with de-duplication and descending sort by `updatedAt`,
 *   (4) Update a record by `fileId` while preserving immutability and sort invariants, and
 *   (5) Remove a record by `fileId` in O(N) time from arrays of modest size.
 *
 *   By keeping these operations pure, `ApiContext` can focus on state management while these
 *   helpers guarantee consistent behavior and testability. All functions below return *new*
 *   arrays or structures and never mutate their inputs. The algorithmic goal is O(N) time and
 *   O(N) space where N is the number of items in a bucket, which is optimal for React state
 *   updates and typical list sizes. Sorting is always stable by `updatedAt` descending, with
 *   missing or invalid timestamps coerced to `new Date(0)` so newest wins ordering is reliable.
 *
 *   NOTE: This file contains no React imports and can be unit-tested in isolation. It does not
 *   perform any network I/O nor reference global singletons. Any logging here is minimal and
 *   intended solely for debugging core list mechanics while avoiding noisy consoles in prod.
 ***********************************************************************************************/

import { UserFileMetadata } from '@/app/src/types/fileTypes';

/**
 * Step 1 — Normalize a possibly invalid date-like to ISO string.
 * Ensures consumers can sort lexicographically on ISO strings.
 * Time: O(1)
 */
export function normalizeIsoDate(input: unknown): string {
  try {
    if (typeof input === 'string') {
      const d = new Date(input);
      return Number.isFinite(d.valueOf()) ? d.toISOString() : new Date(0).toISOString();
    }
    if (input instanceof Date) {
      return Number.isFinite(input.valueOf()) ? input.toISOString() : new Date(0).toISOString();
    }
  } catch {
    // fall through
  }
  return new Date(0).toISOString();
}

/**
 * Step 2 — Comparator for updatedAt descending.
 * Time: O(1)
 */
export function compareUpdatedDesc(a: UserFileMetadata, b: UserFileMetadata): number {
  const ai = normalizeIsoDate(a.updatedAt ?? a.timestamp as any);
  const bi = normalizeIsoDate(b.updatedAt ?? b.timestamp as any);
  // Descending: newer first
  if (ai > bi) return -1;
  if (ai < bi) return 1;
  // Stable tie-breakers to keep deterministic order:
  if (a.fileId > b.fileId) return -1;
  if (a.fileId < b.fileId) return 1;
  return 0;
}

/**
 * Step 3 — Decide bucket from role/owner rules.
 * Owned if role === 'Owner' OR ownerId === currentUserEmail. Shared otherwise.
 * Time: O(1)
 */
export function resolveBucket(
  meta: Pick<UserFileMetadata, 'role' | 'ownerId'>,
  currentUserEmail: string | null | undefined
): 'owned' | 'shared' {
  const me = (currentUserEmail ?? '').trim().toLowerCase();
  const owner = (meta.ownerId ?? '').trim().toLowerCase();
  if (meta.role === 'Owner') return 'owned';
  if (me && owner && me === owner) return 'owned';
  return 'shared';
}

/**
 * Step 4 — Insert meta with dedupe (remove any same fileId across both buckets).
 * Returns new { owned, shared } arrays with `meta` inserted into chosen bucket,
 * normalized and sorted by updatedAt desc.
 * Time: O(N) where N = owned.length + shared.length
 */
export function insertDedupSorted(
  state: { owned: UserFileMetadata[]; shared: UserFileMetadata[] },
  meta: UserFileMetadata,
  currentUserEmail: string | null | undefined
): { owned: UserFileMetadata[]; shared: UserFileMetadata[] } {
  const bucket = resolveBucket(meta, currentUserEmail);
  const target = bucket === 'owned' ? state.owned : state.shared;
  const other = bucket === 'owned' ? state.shared : state.owned;

  // (1) Remove duplicates by fileId from both buckets
  const fileId = meta.fileId;
  const nextOther = other.filter(f => f.fileId !== fileId);
  const nextTarget = target.filter(f => f.fileId !== fileId);

  // (2) Normalize updatedAt before insertion to guarantee order
  const normalized: UserFileMetadata = {
    ...meta,
    updatedAt: normalizeIsoDate(meta.updatedAt ?? meta.timestamp as any),
  };

  // (3) Insert and sort
  const inserted = [...nextTarget, normalized].sort(compareUpdatedDesc);

  return bucket === 'owned'
    ? { owned: inserted, shared: nextOther }
    : { owned: nextOther, shared: inserted };
}

/**
 * Step 5 — Update a record in place by fileId with a partial patch.
 * If the record is absent, returns original arrays unchanged.
 * Re-sorts the affected bucket after patch; moves across buckets if role/owner flips.
 * Time: O(N)
 */
export function updateByIdSorted(
  state: { owned: UserFileMetadata[]; shared: UserFileMetadata[] },
  fileId: string,
  patch: Partial<UserFileMetadata>,
  currentUserEmail: string | null | undefined
): { owned: UserFileMetadata[]; shared: UserFileMetadata[] } {
  const findOwnedIdx = state.owned.findIndex(f => f.fileId === fileId);
  const findSharedIdx = state.shared.findIndex(f => f.fileId === fileId);

  // Not found — nothing to do
  if (findOwnedIdx < 0 && findSharedIdx < 0) return state;

  // Determine source bucket and record
  const fromBucket = findOwnedIdx >= 0 ? 'owned' : 'shared';
  const srcArr = fromBucket === 'owned' ? state.owned : state.shared;
  const idx = fromBucket === 'owned' ? findOwnedIdx : findSharedIdx;
  const existing = srcArr[idx];

  // Merge patch
  const merged: UserFileMetadata = {
    ...existing,
    ...patch,
    updatedAt: normalizeIsoDate((patch.updatedAt ?? existing.updatedAt ?? existing.timestamp) as any),
  };

  // Check if bucket membership changed
  const targetBucket = resolveBucket(merged, currentUserEmail);
  if (targetBucket !== fromBucket) {
    // Remove from source and insert into target via insertDedupSorted to keep invariants
    const removed =
      fromBucket === 'owned'
        ? { owned: srcArr.filter((_, i) => i !== idx), shared: state.shared }
        : { owned: state.owned, shared: srcArr.filter((_, i) => i !== idx) };
    return insertDedupSorted(removed, merged, currentUserEmail);
  }

  // No bucket change → patch in place then sort that bucket
  const nextArr = [...srcArr];
  nextArr[idx] = merged;
  const sorted = nextArr.sort(compareUpdatedDesc);

  return fromBucket === 'owned'
    ? { owned: sorted, shared: state.shared }
    : { owned: state.owned, shared: sorted };
}

/**
 * Step 6 — Remove by fileId from whichever bucket contains it.
 * Returns new arrays and a boolean indicating if removal occurred.
 * Time: O(N)
 */
export function removeById(
  state: { owned: UserFileMetadata[]; shared: UserFileMetadata[] },
  fileId: string
): { owned: UserFileMetadata[]; shared: UserFileMetadata[]; removed: boolean } {
  const ownedFiltered = state.owned.filter(f => f.fileId !== fileId);
  const sharedFiltered = state.shared.filter(f => f.fileId !== fileId);
  const removed = ownedFiltered.length !== state.owned.length || sharedFiltered.length !== state.shared.length;
  return { owned: ownedFiltered, shared: sharedFiltered, removed };
}
