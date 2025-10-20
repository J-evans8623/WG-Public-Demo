// app/src/rate-np/policies.ts

/**
 * @file app/src/rate-np/policies.ts
 * @responsibility
 *   Central registry for NP rate policies. Each policy selects:
 *     1) a scope name (used in Redis keys and logs),
 *     2) an identity mode (now **'user'** for all scopes),
 *     3) the fixed windows implementing your limits:
 *        5m=10, 15m=20, 30m=45, 60m=60.
 *   This file is data-only by design—editing here updates behavior everywhere.
 */

import type { RatePolicy } from './types';

/**
 * @constant NP_WINDOWS
 * @purpose
 *   Shared, immutable window set for all non-premium routes.
 * @steps
 *   1) Define fixed windows in seconds.
 *   2) Freeze to prevent mutation at runtime.
 */
const NP_WINDOWS = Object.freeze([
  { windowSeconds: 60,     maxRequests: 6 },
  { windowSeconds: 5 * 60,  maxRequests: 15 },
  { windowSeconds: 15 * 60, maxRequests: 30 },
  { windowSeconds: 30 * 60, maxRequests: 45 },
  { windowSeconds: 60 * 60, maxRequests: 60 },
]);


const NP_WINDOWS_WRITTERS = Object.freeze([
  { windowSeconds: 60,     maxRequests: 12 },
  { windowSeconds: 5 * 60,  maxRequests: 25 },
  { windowSeconds: 15 * 60, maxRequests: 45 },
  { windowSeconds: 30 * 60, maxRequests: 70 },
  { windowSeconds: 60 * 60, maxRequests: 90 },
]);

const NP_WINDOWS_WRITTERS_XL = Object.freeze([
  { windowSeconds: 60,     maxRequests: 15 },
  { windowSeconds: 5 * 60,  maxRequests: 50 },
  { windowSeconds: 15 * 60, maxRequests: 125 },
  { windowSeconds: 30 * 60, maxRequests: 150 },
  { windowSeconds: 60 * 60, maxRequests: 200 },
]);
/**
 * @constant NP_POLICIES
 * @purpose
 *   Bind each NP scope to **identity: 'user'** and the common window set.
 *   The subject will be `user:<userIdOrEmail>` (see wrapper).
 */
export const NP_POLICIES: Readonly<Record<string, RatePolicy>> = Object.freeze({
  'np:userData':                { scope: 'np:userData',                identity: 'user', windows: NP_WINDOWS },
  'np:forumData':                { scope: 'np:forumData',                identity: 'user', windows: NP_WINDOWS },
  'np:collabConnect':                { scope: 'np:collabConnect',                identity: 'user', windows: NP_WINDOWS },
  'np:asset':                   { scope: 'np:asset',                   identity: 'user', windows: NP_WINDOWS_WRITTERS },
  'np:fileUpload':              { scope: 'np:fileUpload',              identity: 'user', windows: NP_WINDOWS },
  'np:documentSave':            { scope: 'np:documentSave',            identity: 'user', windows: NP_WINDOWS_WRITTERS_XL },
    'np:documentSaveMeta':            { scope: 'np:documentSaveMeta',            identity: 'user', windows: NP_WINDOWS_WRITTERS_XL },
  'np:documentLoad':            { scope: 'np:documentLoad',            identity: 'user', windows: NP_WINDOWS_WRITTERS_XL },
  'np:calendarPersist':         { scope: 'np:calendarPersist',         identity: 'user', windows: NP_WINDOWS },
  'np:calendarNotebookDetails': { scope: 'np:calendarNotebookDetails', identity: 'user', windows: NP_WINDOWS },
  'np:listFiles':               {scope:'nplistFiles', identity:'user', windows:NP_WINDOWS_WRITTERS},
  'np:vhList':                  { scope: 'np:vhList',                  identity: 'user', windows: NP_WINDOWS },
  'np:vhDownload':              { scope: 'np:vhDownload',              identity: 'user', windows: NP_WINDOWS },
  'np:vhSnapshotCreate':        { scope: 'np:vhSnapshotCreate',        identity: 'user', windows: NP_WINDOWS_WRITTERS },
});

/**
 * @function getPolicy
 * @purpose
 *   Lookup a policy by scope name with O(1) access.
 * @steps
 *   1) Read from frozen record.
 *   2) Return null if not found (wrapper throws on unknown scope).
 */
export function getPolicy(scope: keyof typeof NP_POLICIES | string) {
  const p = (NP_POLICIES as any)[scope];
  return (p ?? null) as RatePolicy | null;
}
