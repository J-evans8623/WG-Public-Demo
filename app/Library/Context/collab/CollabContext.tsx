// app/Library/Context/CollabContext.tsx
/***************************************************************************************************
 * @file CollabContext.tsx
 * @description
 *   CollabContext is the single, authoritative owner of the collaboration socket lifecycle. It
 *   provides a minimal public API (status, currentDocId, restart) and deterministically manages a
 *   four-state finite state machine — Idle → Connecting → Connected → Disconnecting → Idle — driven
 *   solely by identity and readiness signals emitted from YDocContext. This context does not gate
 *   or mutate the Y.Doc itself; its only responsibility is to connect the existing collaboration
 *   transport when the document becomes fully "ready" (ACTIVE + saveReady + valid docId + ydoc)
 *   and to disconnect as soon as those preconditions are no longer met (e.g., document switches,
 *   teardown passes, or loss of readiness). Rapid document switches are coalesced by tracking the
 *   latest desired target (docId) and always passing through Disconnecting → Idle before a new
 *   connect is initiated. It listens to the CollaborationManager (via useCollaborationManager)
 *   for connection status and server-initiated closures, normalizing revoke/invalid-token events
 *   to Idle so the next READY pulse reconnects cleanly. All local control logic is O(1); work that
 *   scales with document size is performed by YDocContext or CollaborationManager. This file never
 *   accesses view/UI state and preserves existing styling across the app by remaining headless.
 *   Commentary uses step-numbered style to make the orchestration easy to follow and maintain.
 ***************************************************************************************************/

'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import * as Y from 'yjs';
import { useYDoc } from '@/app/Library/Context/YDocContext';
import { useCollaborationManager } from '@/app/studygraph/(studygraph)/services/collab/useCollaborationManager';

/** 1) Public status exposed by CollabContext (view-agnostic). */
export type CollabFSMStatus = 'Idle' | 'Connecting' | 'Connected' | 'Disconnecting';

/** 2) Context surface for consumers. */
export interface CollabContextType {
  /** Current FSM status (Idle | Connecting | Connected | Disconnecting). */
  status: CollabFSMStatus;
  /** Document id we believe we are (or intend to be) connected to. */
  currentDocId: string | null;
  /**
   * Force a clean teardown of the current collaboration session. The natural driver
   * (YDocContext readiness) will reconnect on the next READY tick. O(1) local.
   */
  restart: () => void;
}

/** 3) Internal shape for tracking identity. */
type Identity = { docId: string; ydoc: Y.Doc } | null;

/** 4) React Context + hook. */
const CollabContext = createContext<CollabContextType | undefined>(undefined);

export const useCollab = (): CollabContextType => {
  const ctx = useContext(CollabContext);
  if (!ctx) throw new Error('useCollab must be used within a CollabProvider');
  return ctx;
};

interface ProviderProps {
  children: ReactNode;
}

/**
 * @function CollabProvider
 * @description
 *   Provider that wires CollabContext to YDocContext + CollaborationManager. It watches a computed
 *   "ready gate" derived entirely from YDocContext (bootPhase === 'ACTIVE' && saveReady && docId &&
 *   ydoc) and deterministically drives the CollaborationManager connect/disconnect operations. On
 *   doc switches or readiness loss, it ensures we always pass through Disconnecting → Idle before
 *   attempting a new connection. It also handles server-initiated closures (revoked/invalid token)
 *   by normalizing the FSM to Idle so the next READY pulse triggers a fresh connect. Complexity is
 *   O(1) per change; only the CollaborationManager performs network I/O. No UI/view state is read.
 */
export const CollabProvider: React.FC<ProviderProps> = ({ children }) => {
  // ────────────────────────────────────────────────────────────────────────────────
  // [Step 1] Inputs from YDocContext (single source of truth for readiness/identity)
  // ────────────────────────────────────────────────────────────────────────────────
  const { bootPhase, saveReady, docFileID, ydoc, getVisibility } = useYDoc();

  // ────────────────────────────────────────────────────────────────────────────────
  // [Step 2] CollaborationManager hook (singleton; stable across renders)
  // ────────────────────────────────────────────────────────────────────────────────
  const {
    status: mgrStatus,
    connect,
    disconnect,
    currentDocId: mgrDocId,
  } = useCollaborationManager({
    // 2.1) When access is revoked by server, normalize to Idle and let READY drive future connects.
    onRevoked: ({ docId }) => {
      console.warn('[CollabContext] onRevoked received, normalizing to Idle', { docId });
      fsmSet('Idle');
    },
    // 2.2) When token invalid/expired and the manager’s auto attempt fails, normalize to Idle.
    onInvalidToken: ({ docId, error }) => {
      console.error('[CollabContext] onInvalidToken received, normalizing to Idle', { docId, error });
      fsmSet('Idle');
    },
  });

  // ────────────────────────────────────────────────────────────────────────────────
  // [Step 3] Local FSM + identity tracking (view-agnostic)
  // ────────────────────────────────────────────────────────────────────────────────
  const [fsm, setFsm] = useState<CollabFSMStatus>('Idle');
  const fsmSet = useCallback((s: CollabFSMStatus) => setFsm(s), []);

  /** 3.1) Identity we intend to connect to (coalesces rapid switches). */
  const desiredRef = useRef<Identity>(null);
  /** 3.2) Snapshot of what we last attempted to connect to (helps filter duplicate connects). */
  const lastAttemptRef = useRef<Identity>(null);
  /** 3.3) Prevent double-disconnect races. */
  const disconnectingRef = useRef(false);

  // ────────────────────────────────────────────────────────────────────────────────
  // [Step 4] Compute the READY gate and target identity (O(1))
  // ────────────────────────────────────────────────────────────────────────────────
  const readyGate = bootPhase === 'ACTIVE' && saveReady && !!docFileID && !!ydoc;

  // update - 1
  // 4.1) Memoize the derived identity so its reference is stable across renders unless inputs change.
  const target: Identity = useMemo(() => {
    return readyGate && docFileID && ydoc ? { docId: docFileID, ydoc } : null;
  }, [readyGate, docFileID, ydoc]); // ensures deps are accurate without recreating a new object each render

  // Keep an easy-to-read current doc id for consumers.
  const exposedDocId = useMemo(() => (target ? target.docId : null), [target]);

  // ────────────────────────────────────────────────────────────────────────────────
  // [Step 5] Reflect CollaborationManager’s status into our FSM (O(1))
  //          We map mgrStatus → FSM states, honoring our Disconnecting guard.
  // ────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // 5.1) If we are in the middle of a controlled disconnect, hold 'Disconnecting'
    // until our explicit disconnect effect completes and sets Idle.
    if (disconnectingRef.current) return;

    if (mgrStatus === 'connecting') fsmSet('Connecting');
    else if (mgrStatus === 'connected') fsmSet('Connected');
    else fsmSet('Idle'); // mgrStatus === 'disconnected'
  }, [mgrStatus, fsmSet]);

  // ────────────────────────────────────────────────────────────────────────────────
  // [Step 6] Orchestrate connect/disconnect based on READY gate & identity changes.
  //          Always pass through Disconnecting → Idle before a new connect.
  //          Complexity: O(1) local; actual I/O is inside CollaborationManager.
  // ────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    // 6.1) Update desired target atomically (coalesces bursts)
    desiredRef.current = target;

    (async () => {
      // 6.2) If there is no ready target, ensure we are disconnected.
      if (!desiredRef.current) {
        if (fsm === 'Connected' || fsm === 'Connecting') {
          disconnectingRef.current = true;
          fsmSet('Disconnecting');
          try {
            disconnect();
          } finally {
            if (!cancelled) {
              disconnectingRef.current = false;
              fsmSet('Idle');
              lastAttemptRef.current = null;
            }
          }
        } else {
          // Already Idle/Disconnecting with no target → remain Idle.
          if (fsm !== 'Disconnecting') fsmSet('Idle');
        }
        return;
      }

      // 6.3) There is a ready target. If already connected to same identity, do nothing.
      const want = desiredRef.current;
      const prev = lastAttemptRef.current;
      if (fsm === 'Connected' && mgrDocId === want.docId) {
        return;
      }
      if (prev && prev.docId === want.docId && fsm === 'Connecting') {
        // A connect is already in flight for the same target.
        return;
      }

      // 6.4) Ensure clean teardown before switching targets.
      if (fsm === 'Connected' || fsm === 'Connecting') {
        disconnectingRef.current = true;
        fsmSet('Disconnecting');
        try {
          disconnect();
        } finally {
          if (cancelled) return;
          disconnectingRef.current = false;
          fsmSet('Idle');
        }
      }

      // 6.5) Initiate a new connect to the latest desired target.
      //      Read visibility only at the action point to avoid stale props churn.
      if (!desiredRef.current || cancelled) return;
      const latest = desiredRef.current;
      const visibility = latest ? getVisibility() : 'private';

      lastAttemptRef.current = latest;
      fsmSet('Connecting');
      try {
        await connect(latest.docId, latest.ydoc, visibility);
        // Success path: mgrStatus effect will reflect Connected.
      } catch (e) {
        // Failure path: normalize to Idle; next READY pulse (or restart) will retry.
        console.error('[CollabContext] connect failed; normalizing to Idle', e);
        if (!cancelled) fsmSet('Idle');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [target, fsm, mgrDocId, connect, disconnect, getVisibility, fsmSet]);

  // ────────────────────────────────────────────────────────────────────────────────
  // [Step 7] Manual restart: force a clean disconnect; READY will drive reconnection.
  // ────────────────────────────────────────────────────────────────────────────────
  const restart = useCallback(() => {
    try {
      disconnectingRef.current = true;
      fsmSet('Disconnecting');
      disconnect();
    } finally {
      // Do not immediately reconnect here; we normalize to Idle and let READY re-fire the connect.
      setTimeout(() => {
        disconnectingRef.current = false;
        fsmSet('Idle');
        // Keep desiredRef as-is; the effect will connect again on the next tick if READY.
      }, 0);
    }
  }, [disconnect, fsmSet]);

  // ────────────────────────────────────────────────────────────────────────────────
  // [Step 8] Memoize public value. No UI state is consumed here.
  // ────────────────────────────────────────────────────────────────────────────────
  const value = useMemo<CollabContextType>(() => {
    return {
      status: fsm,
      currentDocId: exposedDocId,
      restart,
    };
  }, [fsm, exposedDocId, restart]);

  return <CollabContext.Provider value={value}>{children}</CollabContext.Provider>;
};
