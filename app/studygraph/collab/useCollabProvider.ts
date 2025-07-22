// useCollabProvider.ts
/**
 * @file useCollabProvider.ts
 * @responsibility
 *   • Establish Yjs WebSocketProvider with RS256 token subprotocol.
 *   • Conditionally connect only in "public" mode or with an invite cookie.
 *   • Refresh public-mode token just before expiry.
 */

import { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { getCookie } from '../(studygraph)/components/utils/cookies';

export type CollabStatus = 'connecting' | 'connected' | 'disconnected';

export function useCollabProvider(ydoc: Y.Doc, docId: string | null, visibility: 'private'|'public'): { status: CollabStatus } {
  const [status, setStatus] = useState<CollabStatus>('disconnected');
  const refreshTimer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = undefined;
    }
    if (!docId) {
      console.log('useCollabProvider.ts 2001 › No docId, staying offline');
      setStatus('disconnected');
      return;
    }

    const cookieToken = getCookie('bm_collab');
    if (cookieToken) {
      console.log('useCollabProvider.ts 2002 › Using invite cookie token');
      connect([cookieToken]);
      return;
    }

    
    console.log('useCollabProvider.ts 2003 › Document visibility=', visibility);
    if (visibility === 'private') {
      setStatus('disconnected');
      console.log('useCollabProvider.ts 2004 › Private mode, no socket');
      return;
    }

    // Public mode → fetch a fresh token
    (async () => {
      console.log('useCollabProvider.ts 2005 › Fetching public-mode token');
      try {
        const res = await fetch(`/api/collab/start?doc=${encodeURIComponent(docId)}`);
        const { token, expiresIn } = await res.json();
        console.log('useCollabProvider.ts 2006 › Received token, expiresIn=', expiresIn);
        connect([token]);

        // Schedule refresh 1 minute before expiry
        const ms = (expiresIn - 60) * 1000;
        refreshTimer.current = setTimeout(() => {
          console.log('useCollabProvider.ts 2007 › Refreshing public-mode token');
          // Re-run effect
          setStatus('connecting');
        }, ms);
      } catch (err) {
        console.error('useCollabProvider.ts 2008 › Token fetch failed:', err);
        setStatus('disconnected');
      }
    })();

    function connect(protocols: string[]) {
      setStatus('connecting');
      const endpoint = process.env.NEXT_PUBLIC_YJS_ENDPOINT || 'ws://localhost:1234';
      console.log('useCollabProvider.ts 2009 › Connecting to', endpoint, 'with protocols', protocols);
      const provider = new WebsocketProvider(endpoint, docId!, ydoc, { WebSocketPolyfill: WebSocket, protocols });
      provider.on('status', (evt: { status: string }) => {
        const newStatus: CollabStatus = evt.status === 'connected' ? 'connected' : 'disconnected';
        console.log('useCollabProvider.ts 2010 › WebSocketProvider status=', newStatus);
        setStatus(newStatus);
      });
      // Cleanup on unmount or doc change
      return () => {
        console.log('useCollabProvider.ts 2011 › Cleaning up provider');
        provider.disconnect();
        provider.destroy();
        setStatus('disconnected');
      };
    }
  }, [ydoc, docId, visibility]);

  return { status };
}
