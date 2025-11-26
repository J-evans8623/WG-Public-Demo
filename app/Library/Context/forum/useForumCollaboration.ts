/***************************************************************************************************
 * @file useForumCollaboration.ts — Connection-only hook for Forum
 * @responsibility
 *   Manages the Yjs WebSocket lifecycle for the forum namespace. Now exposes a fine-grained
 *   connection phase: 'Idle' | 'Connecting' | 'Connected' | 'Error', while preserving the
 *   old `status.isConnected` boolean for backward compatibility.
 * 
 * @fix Maximum update depth issue resolved by using useRef for phase tracking in guards,
 *      breaking the circular dependency chain while preserving all functionality.
 ***************************************************************************************************/

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';

const WS_BASE = process.env.NEXT_PUBLIC_YJS_ENDPOINT || 'ws://localhost:1234' ;

export type ForumConnectionPhase = 'Idle' | 'Connecting' | 'Connected' | 'Error';

export interface ForumStatus {
  isConnected: boolean;
  lastError: string | null;
  phase: ForumConnectionPhase;
}

export function useForumCollaboration() {
  const providerRef = useRef<any>(null);
  
  // FIX: Track phase in ref for synchronous guard checks without triggering re-renders
  const phaseRef = useRef<ForumConnectionPhase>('Idle');
  
  const [status, setStatus] = useState<ForumStatus>({
    isConnected: false,
    lastError: null,
    phase: 'Idle',
  });

  /**
   * @function connect
   * @description
   *   Start the websocket provider for `forum:<docId>` with precise phase tracking.
   *   Steps:
   *     (1) Guard against missing inputs & redundant connects (using ref for immediate reads)
   *     (2) Fetch RS256 JWT from `/api/forum/start?doc=...`
   *     (3) Create WebsocketProvider with `{ params: { token } }`
   *     (4) Bridge provider 'status' → phase ('Connected' | 'Idle') and isConnected
   *     (5) On failure, set phase 'Error' and bubble the error
   */
  const connect = useCallback(
    async (docId: string, forumDoc: Y.Doc): Promise<void> => {
      // STEP 1 — Guard inputs and duplicate attempts
      if (!docId) throw new Error('connect: missing docId');
      if (!forumDoc) throw new Error('connect: missing forumDoc');
      if (!WS_BASE) throw new Error('connect: .NEXT_PUBLIC_YJS_ENDPOINT not set');
      
      // FIX: Read from ref for immediate guard logic without dependency cycle
      if (phaseRef.current === 'Connecting' || phaseRef.current === 'Connected') {
        // console.log('useForumCollaboration.ts [4110] › connect:no-op (already in progress or up)', { phase: phaseRef.current });
        return;
      }

      try {
        // STEP 2 — Phase → Connecting (update both ref and state)
        // FIX: Update ref immediately for synchronous guard protection
        phaseRef.current = 'Connecting';
        setStatus((s) => ({ ...s, phase: 'Connecting', lastError: null }));
        // console.log('useForumCollaboration.ts [4101] › connect:start', { docId });
        const key = `forum:start:${docId}`;

        // STEP 3 — Token fetch
        const res = await fetch(`/api/forum/start?doc=${encodeURIComponent(docId)}`, {
          method: 'GET',
          credentials: 'include',
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`forum start failed (${res.status}) ${text}`);
        }
        const { token, room } = (await res.json()) as { token: string; room: string };
        const params = { token };

        // STEP 4 — Provider creation + event wiring
        const { WebsocketProvider } = await import('y-websocket');
        const base = WS_BASE.replace(/\/+$/, '');
        providerRef.current = new WebsocketProvider(base, room, forumDoc, { params });

        providerRef.current.on('status', (event: any) => {
          // STEP 4.1 — Map provider status → phase
          const isUp = event?.status === 'connected';
          const nextPhase: ForumConnectionPhase = isUp ? 'Connected' : 'Idle';
          
          // FIX: Update ref for guard logic
          phaseRef.current = nextPhase;
          setStatus((s) => ({ ...s, isConnected: isUp, phase: nextPhase }));
          // console.log('useForumCollaboration.ts [4107] › status', { room, status: event?.status, phase: nextPhase });
        });

        // console.log('useForumCollaboration.ts [4108] › connect:ok', { room, base });
      } catch (err: any) {
        // STEP 5 — Error path
        // FIX: Update ref on error
        phaseRef.current = 'Error';
        setStatus((s) => ({ ...s, isConnected: false, lastError: err?.message ?? 'connect error', phase: 'Error' }));
        console.error('useForumCollaboration.ts [4399] › connect:error', { error: err?.message });
        throw err;
      }
    },
    [], // FIX: Remove status.phase from deps - this breaks the circular dependency
  );

  /**
   * @function disconnect
   * @description
   *   Tear down the websocket provider and reset phase to Idle.
   *   Steps:
   *     (1) Destroy provider if present
   *     (2) Reset status to { isConnected:false, phase:'Idle' }
   *     (3) Swallow and log any teardown warnings
   */
  const disconnect = useCallback(() => {
    try {
      const p = providerRef.current;
      if (p && typeof p.destroy === 'function') {
        p.destroy();
      }
      providerRef.current = null;
      
      // FIX: Update ref on disconnect
      phaseRef.current = 'Idle';
      setStatus({ isConnected: false, lastError: null, phase: 'Idle' });
      // console.log('useForumCollaboration.ts [4109] › disconnect:ok');
    } catch (err: any) {
      console.warn('useForumCollaboration.ts [4401] › disconnect:warn', { error: err?.message });
      
      // FIX: Ensure ref reset even on error
      phaseRef.current = 'Idle';
      setStatus({ isConnected: false, lastError: err?.message ?? null, phase: 'Idle' });
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { connect, disconnect, status };
}