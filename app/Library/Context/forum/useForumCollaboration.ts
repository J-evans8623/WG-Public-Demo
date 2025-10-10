/***************************************************************************************************
 * @file useForumCollaboration.ts — Connection-only hook for Forum
 * @description
 *   This hook is intentionally small and **only** manages the Yjs WebSocket lifecycle for the
 *   forum namespace. It no longer performs any persistence or CRUD. The owner of the forumDoc
 *   is CommentsContext (SSOT). Callers pass a docId and a ready Y.Doc; the hook starts a
 *   WebsocketProvider bound to `forum:<docId>` using a short-lived RS256 token minted by
 *   `/api/forum/start`. We listen to provider status events and expose `isConnected` as a
 *   simple boolean. Destroying the hook or calling `disconnect()` cleans up the provider.
 *
 *   Complexity:
 *     - Connect/disconnect are O(1) operations. Network latency dominates token fetch and socket
 *       setup. No persistence work occurs here. The provider is destroyed on unmount.
 *     - Purposeful logs include file tag + 4-digit codes.
 ***************************************************************************************************/

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';

const WS_BASE = process.env.NEXT_PUBLIC_YJS_ENDPOINT ;

export interface ForumStatus {
  isConnected: boolean;
  lastError: string | null;
}

export function useForumCollaboration() {
  const providerRef = useRef<any>(null);
  const [status, setStatus] = useState<ForumStatus>({ isConnected: false, lastError: null });

  /**
   * @function connect
   * @description
   *   Start the websocket provider for `forum:<docId>`. Requires a ready forumDoc from the caller.
   *   1) Fetch a short-lived JWT from `/api/forum/start?doc=...`
   *   2) Create y-websocket provider with `{ params: { token } }`
   *   3) Bridge 'status' events into `status.isConnected`
   */
  const connect = useCallback(
    async (docId: string, forumDoc: Y.Doc): Promise<void> => {
      if (!docId) throw new Error('connect: missing docId'); // update - 1
      if (!forumDoc) throw new Error('connect: missing forumDoc'); // update - 1
      if (!WS_BASE) throw new Error('connect: .NEXT_PUBLIC_YJS_ENDPOINT not set'); // update - 1

      try {
        console.log('useForumCollaboration.ts [4101] › connect:start', { docId });

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

        const { WebsocketProvider } = await import('y-websocket');
        const base = WS_BASE.replace(/\/+$/, '');
        providerRef.current = new WebsocketProvider(base, room, forumDoc, { params });

        providerRef.current.on('status', (event: any) => {
          const ok = event?.status === 'connected';
          setStatus((s) => ({ ...s, isConnected: ok }));
          console.log('useForumCollaboration.ts [4107] › status', { room, status: event?.status });
        });

        console.log('useForumCollaboration.ts [4108] › connect:ok', { room, base });
      } catch (err: any) {
        setStatus((s) => ({ ...s, isConnected: false, lastError: err?.message ?? 'connect error' }));
        console.error('useForumCollaboration.ts [4399] › connect:error', { error: err?.message });
        throw err;
      }
    },
    [],
  );

  /**
   * @function disconnect
   * @description
   *   Tear down the websocket provider to avoid cross-doc leakage. No-op if not connected.
   */
  const disconnect = useCallback(() => {
    try {
      const p = providerRef.current;
      if (p && typeof p.destroy === 'function') {
        p.destroy();
      }
      providerRef.current = null;
      setStatus((s) => ({ ...s, isConnected: false }));
      console.log('useForumCollaboration.ts [4109] › disconnect:ok');
    } catch (err: any) {
      console.warn('useForumCollaboration.ts [4401] › disconnect:warn', { error: err?.message });
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
