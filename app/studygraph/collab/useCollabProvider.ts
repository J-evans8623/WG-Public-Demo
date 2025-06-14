/**
 * useCollabProvider.ts
 *
 * Responsibilities:
 *  - Instantiate and manage a Yjs WebSocketProvider against the BFF proxy endpoint.
 *  - Use the BFF’s `/api/collab/ws?doc=<docId>` route for authentication and token injection.
 *  - Handle automatic reconnect/disconnect when docId changes or component unmounts.
 *  - Expose connection status and control methods (disconnect, reconnect).
 */

import { useEffect, useState, useRef } from 'react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

export type CollabStatus = 'connecting' | 'connected' | 'disconnected';

export interface CollabProvider {
  status: CollabStatus;
  disconnect: () => void;
  reconnect: () => void;
}

export function useCollabProvider(
  ydoc: Y.Doc,
  docId: string | null
): CollabProvider {
  const providerRef = useRef<WebsocketProvider | null>(null);
  const [status, setStatus] = useState<CollabStatus>('disconnected');

  useEffect(() => {
    // Tear down any existing provider
    if (providerRef.current) {
      providerRef.current.destroy();
      providerRef.current = null;
      setStatus('disconnected');
    }

    // Only initialize in browser when docId is available
    if (!docId || typeof window === 'undefined') {
      return;
    }

    // Build the BFF WebSocket URL, using WS or WSS based on current origin
    const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${wsScheme}://${window.location.host}/api/collab/ws?doc=${encodeURIComponent(docId)}`;

    // Create the provider without passing a token (BFF handles it)
    const provider = new WebsocketProvider(wsUrl, docId, ydoc);
    providerRef.current = provider;
    setStatus(provider.wsconnected ? 'connected' : 'connecting');

    // Listen for connection status changes
    const handleStatus = () => {
      setStatus(provider.wsconnected ? 'connected' : 'disconnected');
    };
    provider.on('status', handleStatus);

    // Cleanup on unmount or docId change
    return () => {
      provider.off('status', handleStatus);
      provider.destroy();
      providerRef.current = null;
    };
  }, [ydoc, docId]);

  // Explicit disconnect control
  const disconnect = () => {
    if (providerRef.current) {
      providerRef.current.disconnect();
      setStatus('disconnected');
    }
  };

  // Explicit reconnect control
  const reconnect = () => {
    if (providerRef.current) {
      providerRef.current.connect();
      setStatus(providerRef.current.wsconnected ? 'connected' : 'connecting');
    }
  };

  return { status, disconnect, reconnect };
}
