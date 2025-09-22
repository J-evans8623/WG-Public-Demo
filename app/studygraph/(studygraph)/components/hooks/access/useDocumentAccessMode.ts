/**bloom-maps\app\studygraph\(studygraph)\components\hooks\access\useDocumentAccessMode.ts
 * @file useDocumentAccessMode.ts
 * @description
 * This file defines a production-ready React hook, `useDocumentAccessMode`, that exposes a single,
 * authoritative view of a document’s access state derived exclusively from the Document Access Manager
 * (DAM) singleton. Its purpose is to unify capability gating across the UI by returning a compact,
 * reactive object `{ mode, status, docId }`, where `mode` is `'edit' | 'readonly'`, `status` is
 * `'PENDING' | 'READY'`, and `docId` is the currently selected document identifier or `null`. The hook
 * performs O(1) work per polling tick and only updates React state when values change, avoiding noisy
 * renders. It intentionally does not consult any other providers (e.g., YDoc visibility) and therefore
 * prevents accidental fallbacks or heuristics from influencing UI permissions. Subtle, purposeful logs
 * (tagged with file name and a unique 4-digit code) mark mount, transitions, and unmount for reliable
 * observability in production. The file also exports `isEditReady` for handler-level gating convenience,
 * plus minimal TypeScript types to standardize usage in consuming components. It dispatches a lightweight
 * `CustomEvent('dam:access-state')` on `window` whenever the derived access snapshot changes to support
 * optional, framework-agnostic observers without adding hard dependencies or event emitters to DAM.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import DocumentAccessManager from './DocumentAccessManager';

/** Access mode derived strictly from DAM. */
export type AccessMode = 'edit' | 'readonly';

/** Access readiness status as maintained by DAM’s workflow. */
export type AccessStatus = 'PENDING' | 'READY';

/** Public shape returned by the hook. */
export interface AccessSnapshot {
  mode: AccessMode;
  status: AccessStatus;
  docId: string | null;
}

/**
 * @function useDocumentAccessMode
 * @description
 * Subscribes to the Document Access Manager (DAM) as the single source of truth for document mode
 * and readiness. It returns `{ mode, status, docId }` derived exclusively from DAM without any
 * fallbacks to other stores. The hook uses a compact polling loop (default 250ms) that compares
 * the latest DAM snapshot to the previous render, emitting state updates—and a `dam:access-state`
 * CustomEvent on `window`—only when values change. This design guarantees O(1) work per tick,
 * stable reactivity, and deterministic capability gating for upstream components.
 */
export function useDocumentAccessMode(pollMs: number = 250): AccessSnapshot {
  const managerRef = useRef(DocumentAccessManager.getInstance());

  // Local helper to compute the current snapshot from DAM in O(1)
  const computeSnapshot = (): AccessSnapshot => {
    const m = managerRef.current;
    const docId = m.getCurrentDocId();
    const status = m.getStatus() as AccessStatus;
    const canEdit = docId ? m.canEdit(docId) : false;
    const mode: AccessMode = canEdit ? 'edit' : 'readonly';
    return { mode, status, docId };
  };

  // Initialize state from DAM once (no other sources consulted)
  const [snapshot, setSnapshot] = useState<AccessSnapshot>(() => {
    const initial = computeSnapshot();
    console.log('[useDocumentAccessMode.ts][4101] mount → initial snapshot', initial);
    return initial;
  });

  // Stable ref to hold the last snapshot for change detection without extra renders
  const lastRef = useRef<AccessSnapshot>(snapshot);

  useEffect(() => {
    let alive = true;

    // Polling loop: minimal, O(1), and stateful-change aware
    const tick = () => {
      if (!alive) return;
      try {
        const next = computeSnapshot();
        const prev = lastRef.current;

        // Change detection: stringify is safe/cheap here (3 small scalars), but we do field checks to avoid allocs.
        const changed =
          next.mode !== prev.mode ||
          next.status !== prev.status ||
          next.docId !== prev.docId;

        if (changed) {
          console.log('[useDocumentAccessMode.ts][4102] snapshot changed', { from: prev, to: next });
          lastRef.current = next;
          setSnapshot(next);

          // Lightweight broadcast for optional non-React observers
          try {
            window.dispatchEvent(
              new CustomEvent<AccessSnapshot>('dam:access-state', { detail: next })
            );
          } catch (err) {
            // Avoid noisy logs; this should never fail in modern browsers
            // but we keep it guarded in case of server-like environments.
          }
        }
      } catch (err) {
        // Defensive logging only—never throw from poller
        console.warn('[useDocumentAccessMode.ts][4104] polling error (ignored)', err);
      }
    };

    // Start a compact interval; requestAnimationFrame is overkill for access state.
    const id = window.setInterval(tick, pollMs);

    // Fire one eager tick to reduce UI latency after mount
    tick();

    return () => {
      alive = false;
      window.clearInterval(id);
      console.log('[useDocumentAccessMode.ts][4103] unmount → polling stopped');
    };
  }, [pollMs]);

  // Expose a memoized snapshot object for referential stability to consumers when values don’t change.
  return useMemo(() => snapshot, [snapshot]);
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

/* -------------------------------------------------------------------------------------------------
 * Notes on complexity and observability:
 * - Each poll computes a constant-size snapshot from DAM with O(1) lookups and comparisons.
 * - State updates only occur on actual changes, minimizing renders and logs.
 * - Logs (codes 4101–4104) pinpoint mount, transitions, errors, and cleanup for production triage.
 * - The optional CustomEvent allows external instrumentation to observe access transitions without
 *   coupling those listeners to React lifecycles.
 * ------------------------------------------------------------------------------------------------- */
