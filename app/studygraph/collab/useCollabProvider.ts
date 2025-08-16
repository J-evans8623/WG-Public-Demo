/**
 * @file useCollabProvider.ts
 * @responsibility
 *   This hook establishes and maintains a Yjs WebSocket collaboration channel for a given Y.Doc
 *   and document identifier. FIXED: URL construction to prevent JWT corruption.
 */

import { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { getCookie } from '../(studygraph)/components/utils/cookies';

export type CollabStatus = 'connecting' | 'connected' | 'disconnected';

type TokenBundle = { token: string; expiresIn?: number };

type Options = {
  /** Called when server kicks the user (revoked → close code 4003). */
  onRevoked?: (ctx: { docId: string }) => void;
  /** Called when token is invalid/expired (close code 4002) and the auto single-retry also fails. */
  onInvalidToken?: (ctx: { docId: string; error?: unknown }) => void;
};

/**
 * @function useCollabProvider
 * @description
 *   FIXED VERSION: Establishes a Yjs WebSocketProvider with correct URL construction
 *   to prevent JWT token corruption.
 */
export function useCollabProvider(
  ydoc: Y.Doc,
  docId: string | null,
  _visibility: 'private' | 'public',
  opts: Options = {}
): { status: CollabStatus } {
  const [status, setStatus] = useState<CollabStatus>('disconnected');
  const providerRef = useRef<WebsocketProvider | null>(null);
  const refreshTimer = useRef<NodeJS.Timeout | null>(null);
  const triedImmediateFixRef = useRef(false);
  const connectionAttemptRef = useRef(0);
  const isDevMode = process.env.NODE_ENV === 'development';

  useEffect(() => {
    // [STEP 1] Small utilities to keep lifecycle tidy.
    const clearTimers = () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
    };

    const destroyProvider = () => {
      try {
        providerRef.current?.disconnect();
        providerRef.current?.destroy();
      } catch {}
      providerRef.current = null;
    };

    // [STEP 2] Early exit if no document id.
    if (!docId) {
      console.log('useCollabProvider.ts [7321] › No docId; ensuring disconnected state.');
      clearTimers();
      destroyProvider();
      setStatus('disconnected');
      return;
    }

    // [STEP 3] Gentle backoff for rapid re-connects in dev.
    const connectionDelay = isDevMode ? Math.min(connectionAttemptRef.current * 500, 3000) : 0;
    connectionAttemptRef.current++;

    let aborted = false;
    triedImmediateFixRef.current = false;
    setStatus('connecting');

    const connectTimeout = setTimeout(async () => {
      if (aborted) return;

      try {
        console.log('useCollabProvider.ts [7322] › Connecting...', {
          docId,
          attempt: connectionAttemptRef.current,
          delayMs: connectionDelay
        });

        // [STEP 4] Acquire token (cookie shortcut if present).
        const cookieJwt = getCookie('bm_collab');
        const tb = cookieJwt ? { token: cookieJwt } : await fetchToken(docId);
        if (aborted) return;

        // [STEP 5] Establish provider with FIXED URL composition.
        await connectWithToken(docId, ydoc, tb.token, onWsClose);
        setStatus('connected');
        scheduleRefreshIfPossible(tb);

        // Reset attempt counter on success.
        connectionAttemptRef.current = 0;
      } catch (err) {
        console.error('useCollabProvider.ts [7323] › ❌ Connection failed:', err);
        setStatus('disconnected');
      }
    }, connectionDelay);

    /**
     * @function fetchToken
     * @description
     *   Retrieves a JWT for the given document from the collab bootstrap endpoint.
     */
    async function fetchToken(doc: string): Promise<TokenBundle> {
      console.log('useCollabProvider.ts [7324] › Fetching token for doc:', doc);
      const res = await fetch(`/api/collab/startv1?doc=${encodeURIComponent(doc)}`, {
        credentials: 'include'
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('useCollabProvider.ts [7325] › ❌ Token fetch failed:', res.status, errorText);
        throw new Error(`collab/start failed: ${res.status} ${errorText}`);
      }

      const { token, expiresIn } = await res.json();
      console.log('useCollabProvider.ts [7326] › ✅ Token fetched; expiresIn(s)=', expiresIn);
      return { token, expiresIn };
    }

    /**
     * @function connectWithToken
     * @description
     *   FIXED: Creates a WebsocketProvider using a manually constructed URL to avoid
     *   any issues with y-websocket's params handling. We build the complete URL
     *   ourselves and pass it as the serverUrl parameter.
     */
    async function connectWithToken(doc: string, d: Y.Doc, jwt: string, onClose: (ev: CloseEvent) => void) {
      console.log('useCollabProvider.ts [7327] › Initiating WS connect', {
        doc,
        jwtLen: jwt.length
      });

      // 1) Clean state before reconnect.
      clearTimers();
      destroyProvider();

      // 2) FIXED: Build the complete WebSocket URL manually
      const rawEndpoint = process.env.NEXT_PUBLIC_YJS_ENDPOINT || 'ws://localhost:1234';
      const endpoint = rawEndpoint.replace(/\/+$/, ''); // strip trailing slashes
      const encodedDoc = encodeURIComponent(doc);
      const encodedToken = encodeURIComponent(jwt);
      
      // Construct the complete URL with token as query parameter
      const completeUrl = `${endpoint}/${encodedDoc}?token=${encodedToken}`;

      console.log('useCollabProvider.ts [7328] › Creating provider with complete URL');
      console.log('useCollabProvider.ts [7328] › URL length:', completeUrl.length);
      console.log('useCollabProvider.ts [7328] › Token length:', jwt.length);

      // 3) Create provider with the complete URL as serverUrl
      // Use empty string as room since we've already included the doc in the URL
      const provider = new WebsocketProvider(completeUrl, '', d, {
        WebSocketPolyfill: WebSocket,
        // Don't use params at all - we've embedded everything in the URL
      });

      // 4) Provider event wiring (focused & purposeful).
      provider.on('status', (evt: { status: string }) => {
        console.log('useCollabProvider.ts [7329] › Provider status:', evt.status);
        setStatus(evt.status === 'connected' ? 'connected' : 'disconnected');
      });

      provider.on('connection-close', (evt: unknown) => {
        console.log('useCollabProvider.ts [7330] › connection-close event:', evt);
      });

      provider.on('connection-error', (evt: unknown) => {
        console.error('useCollabProvider.ts [7331] › ❌ connection-error event:', evt);
      });

      provider.on('sync', (isSynced: boolean) => {
        console.log('useCollabProvider.ts [7332] › Sync state:', isSynced ? 'synced' : 'syncing');
      });

      // 5) Underlying WebSocket taps for URL sanity and close codes.
      const ws = (provider as any).ws as WebSocket | undefined;
      if (ws) {
        // Log the actual URL being used (safely)
        const safeUrl = (() => {
          try {
            const u = new URL(ws.url);
            if (u.searchParams.get('token')) {
              u.searchParams.set('token', 'JWT_TOKEN_HIDDEN');
            }
            return u.toString();
          } catch {
            return '(unavailable)';
          }
        })();

        console.log('useCollabProvider.ts [7333] › WS created; url=', safeUrl);
        console.log('useCollabProvider.ts [7334] › WS readyState=', ws.readyState);

        ws.addEventListener('open', () => {
          console.log('useCollabProvider.ts [7335] › WS OPEN');
        });

        ws.addEventListener('error', (event) => {
          console.error('useCollabProvider.ts [7336] › ❌ WS ERROR:', event);
        });

        ws.addEventListener('close', (event) => {
          console.log('useCollabProvider.ts [7337] › WS CLOSE', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
          });
          onClose(event);
        });
      } else {
        console.error('useCollabProvider.ts [7338] › ❌ Provider did not expose a WebSocket instance.');
        throw new Error('WebSocket provider failed to create connection');
      }

      providerRef.current = provider;
      console.log('useCollabProvider.ts [7339] › Provider initialized.');
    }

    /**
     * @function scheduleRefreshIfPossible
     * @description
     *   Schedules a token refresh slightly before the advertised expiry.
     */
    function scheduleRefreshIfPossible(tb: TokenBundle) {
      clearTimers();
      if (!tb.expiresIn || tb.expiresIn <= 90) {
        console.log('useCollabProvider.ts [7340] › Skipping refresh scheduling; expiresIn too small:', tb.expiresIn);
        return;
      }

      const refreshInMs = (tb.expiresIn - 60) * 1000;
      console.log('useCollabProvider.ts [7341] › Scheduling token refresh in(s)=', refreshInMs / 1000);

      refreshTimer.current = setTimeout(async () => {
        try {
          console.log('useCollabProvider.ts [7342] › Refreshing token...');
          const ntb = await fetchToken(docId!);
          await connectWithToken(docId!, ydoc, ntb.token, onWsClose);
          setStatus('connected');
          scheduleRefreshIfPossible(ntb);
        } catch (err) {
          console.error('useCollabProvider.ts [7343] › ❌ Token refresh failed:', err);
          setStatus('disconnected');
        }
      }, refreshInMs);
    }

    /**
     * @function onWsClose
     * @description
     *   Central handler for WebSocket close events.
     */
    async function onWsClose(ev: CloseEvent) {
      console.log('useCollabProvider.ts [7344] › WS closed', { code: ev.code, reason: ev.reason });

      // 4003 → revoked: let the app decide (downgrade or route)
      if (ev.code === 4003) {
        console.log('useCollabProvider.ts [7345] › Access revoked by server (4003).');
        opts.onRevoked?.({ docId: docId! });
        setStatus('disconnected');
        return;
      }

      // 4002 → invalid/expired token: try one immediate refresh; then delegate
      if (ev.code === 4002 && !triedImmediateFixRef.current) {
        triedImmediateFixRef.current = true;
        console.log('useCollabProvider.ts [7346] › Token invalid (4002); attempting immediate refresh...');
        try {
          const ntb = await fetchToken(docId!);
          await connectWithToken(docId!, ydoc, ntb.token, onWsClose);
          setStatus('connected');
          scheduleRefreshIfPossible(ntb);
          return;
        } catch (e) {
          console.error('useCollabProvider.ts [7347] › ❌ Immediate token refresh failed:', e);
          opts.onInvalidToken?.({ docId: docId!, error: e });
        }
      }

      setStatus('disconnected');
    }

    // [STEP 6] Cleanup on dependency change/unmount.
    return () => {
      aborted = true;
      clearTimeout(connectTimeout);
      clearTimers();
      destroyProvider();
      setStatus('disconnected');
    };
  }, [ydoc, docId, opts, isDevMode]);

  return { status };
}