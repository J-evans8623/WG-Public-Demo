/***************************************************************************************
 * @file app/src/access/collabAdapter.ts
 * @description
 *   Thin, declarative bridge that lets the client’s collaboration layer (Yjs WS client)
 *   translate connection events into AccessLayer signals—without importing transport code
 *   into UI components. This adapter decodes a trusted JWT (if provided at connect time)
 *   to seed an initial role, and it handles WS close code 4003 (“permission revoked”)
 *   by emitting an EDIT_REVOKED signal. The adapter does *not* open sockets; it only
 *   exposes small helpers you can call from your collab client. It is safe to import in
 *   React hooks/effects. Focused logs carry stable codes for production debugging.
 *
 * Responsibilities:
 *   1) Decode role from a Yjs JWT (if available) and seed AccessLayer.
 *   2) Map WS close 4003 to an EDIT_REVOKED signal.
 *   3) Provide small, composable helpers so collab client code stays minimal.
 ***************************************************************************************/

'use client';

import { useCallback } from 'react';
import { useAccessLayer } from '@/app/Library/Context/AccessLayerContext';
import type { Role } from '@/app/studygraph/(studygraph)/types/access';

function decodeRoleFromJwt(token: string): Role | null {
  try {
    // JWT has three parts. We only need payload; no signature verification here.
    const payload = JSON.parse(atob(token.split('.')[1] || ''));
    const r = (payload?.role || payload?.r || '').toString();
    if (r === 'Owner' || r === 'Editor' || r === 'Viewer') return r;
    return null;
  } catch {
    return null;
  }
}

/**
 * @function useCollabAccessBridge
 * @description
 *   Hook used by the Yjs client code: call `onConnected(token)` once when the WS
 *   connection is established (if you have the token), and call `onClosed(code)`
 *   whenever the socket closes. The hook forwards normalized signals to the
 *   AccessLayer, which updates the UI predictably.
 */
export function useCollabAccessBridge() {
  const access = useAccessLayer();

  const onConnected = useCallback((jwtToken?: string) => {
    if (!jwtToken) return;
    const role = decodeRoleFromJwt(jwtToken);
    if (role) {
      console.log('[collabAdapter.ts][9401] yjs connected; seeding role from jwt', { role });
      access.setRole(role, 'yjs');
    }
  }, [access]);

  const onClosed = useCallback((closeCode: number) => {
    if (closeCode === 4003) {
      console.log('[collabAdapter.ts][9402] yjs closed with 4003; applying EDIT_REVOKED');
      // Signal-only: role will be reconciled by the server on subsequent calls
      access.applySignal({
        docId: access.docId || '',
        role: 'Viewer',
        signal: 'EDIT_REVOKED',
        source: 'yjs',
        at: new Date().toISOString(),
      });
    } else {
      console.log('[collabAdapter.ts][9403] yjs closed', { code: closeCode });
    }
  }, [access]);

  return { onConnected, onClosed };
}
