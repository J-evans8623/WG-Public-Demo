/**
 * @file useCollabProvider.ts
 * @responsibility
 *   • Establish Yjs WebSocketProvider with RS256 token subprotocol ("token,<jwt>").
 *   • Auto-refresh token before expiry by reconnecting with a new JWT.
 *   • Handle server-forced disconnects:
 *       - 4003 (revoked): re-bootstrap → downgrade to viewer or route away.
 *       - 4002 (invalid/expired): single immediate refresh + reconnect.
 */
import { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { getCookie } from '../(studygraph)/components/utils/cookies';

export type CollabStatus = 'connecting' | 'connected' | 'disconnected';

type TokenBundle = { token: string; expiresIn?: number };

type Options = {
  /** Called when server kicks the user (revoked → close code 4003).
   *  You typically re-bootstrap ACL and downgrade to viewer or route away. */
  onRevoked?: (ctx: { docId: string }) => void;
  /** Called when token is invalid/expired (close code 4002) and the auto single-retry also fails. */
  onInvalidToken?: (ctx: { docId: string; error?: unknown }) => void;
};

export function useCollabProvider(
  ydoc: Y.Doc,
  docId: string | null,
  _visibility: 'private'|'public', // kept for API compatibility; no longer gates socket
  opts: Options = {}
): { status: CollabStatus } {
  const [status, setStatus] = useState<CollabStatus>('disconnected');
  const providerRef = useRef<WebsocketProvider | null>(null);
  const refreshTimer = useRef<NodeJS.Timeout | null>(null);
  const triedImmediateFixRef = useRef(false);

  useEffect(() => {
    const clearTimers = () => { if (refreshTimer.current) { clearTimeout(refreshTimer.current); refreshTimer.current = null; } };
    const destroyProvider = () => { try { providerRef.current?.disconnect(); providerRef.current?.destroy(); } catch {} providerRef.current = null; };

    if (!docId) { clearTimers(); destroyProvider(); setStatus('disconnected'); return; }

    let aborted = false;
    triedImmediateFixRef.current = false;
    setStatus('connecting');

    (async () => {
      try {
        const cookieJwt = getCookie('bm_collab');
        const tb = cookieJwt ? { token: cookieJwt } : await fetchToken(docId);
        if (aborted) return;
        await connectWithToken(docId, ydoc, tb.token, onWsClose);
        setStatus('connected');
        scheduleRefreshIfPossible(tb);
      } catch (err) {
        setStatus('disconnected');
      }
    })();

    async function fetchToken(doc: string): Promise<TokenBundle> {
      const res = await fetch(`/api/collab/start?doc=${encodeURIComponent(doc)}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`collab/start failed: ${res.status}`);
      const { token, expiresIn } = await res.json();
      return { token, expiresIn };
    }

    async function connectWithToken(doc: string, d: Y.Doc, jwt: string, onClose: (ev: CloseEvent) => void) {
      clearTimers(); destroyProvider();
      const endpoint = process.env.NEXT_PUBLIC_YJS_ENDPOINT || 'ws://localhost:1234';
      const provider = new WebsocketProvider(endpoint, doc, d, {
        WebSocketPolyfill: WebSocket,
        protocols: [`token,${jwt}`], // <- server expects "token,<jwt>"
      });
      provider.on('status', (evt: { status: string }) => setStatus(evt.status === 'connected' ? 'connected' : 'disconnected'));
      const ws = (provider as any).ws as WebSocket | undefined;
      ws?.addEventListener('close', onClose);
      providerRef.current = provider;
    }

    function scheduleRefreshIfPossible(tb: TokenBundle) {
      clearTimers();
      if (!tb.expiresIn || tb.expiresIn <= 90) return;
      refreshTimer.current = setTimeout(async () => {
        try {
          const ntb = await fetchToken(docId!);
          await connectWithToken(docId!, ydoc, ntb.token, onWsClose);
          setStatus('connected');
          scheduleRefreshIfPossible(ntb);
        } catch {
          setStatus('disconnected');
        }
      }, (tb.expiresIn - 60) * 1000);
    }

    async function onWsClose(ev: CloseEvent) {
      // 4003 → revoked: let the app decide (downgrade or route)
      if (ev.code === 4003) {
        opts.onRevoked?.({ docId: docId! });
        setStatus('disconnected');
        return;
      }
      // 4002 → invalid/expired token: try one immediate refresh; then delegate
      if (ev.code === 4002 && !triedImmediateFixRef.current) {
        triedImmediateFixRef.current = true;
        try {
          const ntb = await fetchToken(docId!);
          await connectWithToken(docId!, ydoc, ntb.token, onWsClose);
          setStatus('connected');
          scheduleRefreshIfPossible(ntb);
          return;
        } catch (e) {
          opts.onInvalidToken?.({ docId: docId!, error: e });
        }
      }
      setStatus('disconnected');
    }

    return () => { aborted = true; clearTimers(); destroyProvider(); setStatus('disconnected'); };
  }, [ydoc, docId, opts]); // visibility intentionally not used for gating

  return { status };
}
