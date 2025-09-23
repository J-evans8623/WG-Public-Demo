/**bloom-maps\app\studygraph\(studygraph)\components\hooks\access\useDocumentAccessMode.ts
 * @file useDocumentAccessMode.ts
 * @description
 * This file defines a production-ready React hook, `useDocumentAccessMode`, that exposes a single,
 * authoritative view of a document’s access state derived exclusively from the Document Access Manager
 * (DAM) singleton. Its purpose is to unify capability gating across the UI by returning a compact,
 * reactive object `{ mode, status, docId }`, where `mode` is `'edit' | 'readonly'`, `status` is
 * `'PENDING' | 'READY'`, and `docId` is the currently selected document identifier or `null`. The hook
 * originally used a polling loop to detect changes and dispatch a CustomEvent for external observers.
 *
 * Update (Strategy A):
 *   1) Replaced polling with **React-native** `useSyncExternalStore`, subscribing directly to DAM’s
 *      new event-driven API for immediate, minimal updates (concurrent-mode safe).
 *   2) Internally computes a memoized `editReady` boolean (`mode === 'edit' && status === 'READY'`)
 *      so heavy consumers can gate UI without re-rendering on irrelevant field changes.
 *   3) Preserves the hook’s external shape while adding `editReady` to the returned object. Existing
 *      call sites that destructure `{ mode, status }` remain valid; consumers can opt-in to `editReady`.
 *   4) Maintains O(1) per render and avoids noisy logs in the hot path. Logs only mark mount and the
 *      first successful subscription, plus SSR hydration guardrails.
 */

import { useRef, useMemo } from 'react';                                         // update - 1
import { useSyncExternalStore } from 'react';                                    // update - 2
import DocumentAccessManager from './DocumentAccessManager';

/** Access mode derived strictly from DAM. */
export type AccessMode = 'edit' | 'readonly';

/** Access readiness status as maintained by DAM’s workflow. */
export type AccessStatus = 'PENDING' | 'READY';

/** Public shape returned by the hook (now includes editReady). */               // update - 3
export interface AccessSnapshot {
  mode: AccessMode;
  status: AccessStatus;
  docId: string | null;
  editReady: boolean;                                                            // update - 3
}

/**
 * @function useDocumentAccessMode
 * @description
 * Subscribes to the Document Access Manager (DAM) as the single source of truth for document mode
 * and readiness. It returns `{ mode, status, docId, editReady }` derived exclusively from DAM without
 * fallbacks to other stores. The hook leverages `useSyncExternalStore` for event-driven updates that
 * are concurrent-mode safe, and memoizes the final object so identity changes only when a field changes.
 * Time complexity: O(1) subscribe; O(1) snapshot derivation.
 */
export function useDocumentAccessMode(_pollMs: number = 250): AccessSnapshot {   // update - 4
  // 1) Singleton reference (stable)                                             // update - 5
  const managerRef = useRef(DocumentAccessManager.getInstance());               // update - 5
  const m = managerRef.current;                                                 // update - 5

  // 2) Subscribe via React’s external store bridge                              // update - 6
  const subscribe = useMemo(() => {
    return (cb: () => void) => {
      const unsub = m.subscribe(cb);
      console.log('[useDocumentAccessMode.ts][5101] subscribed via useSyncExternalStore'); // update - 6
      return unsub;
    };
  }, [m]);

  // 3) Pure snapshot readers (SSR-safe)                                         // update - 7
  const getSnapshot = useMemo(() => {
    return () => m.getSnapshot();
  }, [m]);                                                                       // update - 7

  const getServerSnapshot = useMemo(() => {
    // Server-safe conservative snapshot; avoid touching window/document.        // update - 8
    return () => m.getSnapshot();
  }, [m]);                                                                       // update - 8

  // 4) Read the external snapshot (object with { mode, status, docId })         // update - 9
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);   // update - 9

  // 5) Compute memoized selector and compact return object                      // update - 10
  const editReady = raw.mode === 'edit' && raw.status === 'READY';               // update - 10

  // NOTE: raw is already minimal; wrapping once to include editReady.           // update - 11
  // The memoization ensures stable identity unless a field actually changes.    // update - 11
  const out: AccessSnapshot = useMemo(() => {
    return { mode: raw.mode, status: raw.status, docId: raw.docId, editReady };
  }, [raw.mode, raw.status, raw.docId, editReady]);                              // update - 11

  return out;                                                                    // update - 12
}

/**
 * @function isEditReady
 * @description
 * Tiny convenience predicate for UI/handler gating. It returns `true` only when the caller is in
 * edit mode *and* the DAM workflow is READY. Using this guard uniformly across mutating handlers
 * (rename, generate, create, upload, paste, delete) ensures deterministic behavior during access
 * transitions and avoids accidental edits when status is still pending. This function is O(1) and
 * intentionally side-effect free so it can be inlined in event handlers or memoized callbacks.
 */
export function isEditReady(mode: AccessMode, status: AccessStatus): boolean {
  return mode === 'edit' && status === 'READY';
}
