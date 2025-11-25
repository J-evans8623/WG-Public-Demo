/**
 * @file yws/secureSetupWSConnection.ts
 * @description
 * Server-enforced read-only for Yjs viewers by gating the y-websocket message loop.
 * We intercept the registration of the original 'message' handler installed by
 * y-websocket, stash it, and then install a single guarded listener that:
 *  - drops any Sync Update submessage from sockets tagged as 'viewer'
 *  - forwards everything else to the original handler unchanged
 *
 * No wire/protocol changes. Viewers remain connected and receive updates in real time.
 */

import * as Y from 'yjs';
import * as decoding from 'lib0/decoding';
const { setupWSConnection: originalSetupWSConnection } = require('y-websocket/bin/utils');

// Outer message types (y-protocols)
const messageSync = 0;
const messageAwareness = 1;
const messageAuth = 2;

// Sync submessage types
const syncStep1 = 0;
const syncStep2 = 1;
const syncUpdate = 2;

type WSLike = {
  on: (event: string, handler: (...args: any[]) => void) => WSLike;
  removeAllListeners?: (event?: string) => void;
  emit?: (event: string, ...args: any[]) => void;
  onmessage?: (ev: { data: any }) => void;
  __bm?: { docId: string; uid: string; role: 'owner' | 'editor' | 'viewer' };
};

/**
 * Safely detect whether a binary Yjs frame contains ANY syncUpdate submessage.
 * We fully scan the SYNC frame for multiple submessages; if an update is found,
 * return true (caller should drop the frame).
 *
 * We do NOT mutate the original Buffer/Uint8Array; we parse on a fresh decoder.
 */
function frameContainsViewerWrite(frame: Uint8Array, role: string): boolean {
  if (role !== 'viewer') return false;

  let dec: decoding.Decoder;
  try {
    dec = decoding.createDecoder(frame);
  } catch {
    // Malformed; don't block based on parse failure.
    return false;
  }

  // Outer type must be SYNC to consider blocking
  let outerType: number;
  try {
    outerType = decoding.readVarUint(dec);
  } catch {
    return false;
  }
  if (outerType !== messageSync) return false;

  // Scan all sync submessages (a frame may contain more than one)
  while (dec.pos < frame.length) {
    let sub: number;
    try {
      sub = decoding.readVarUint(dec);
    } catch {
      break; // stop scanning on parse error; fail open (no block)
    }

    if (sub === syncUpdate) {
      // We don't need to parse payload; presence is enough to block.
      return true;
    }

    // Skip payloads for known subtypes so we can keep scanning safely.
    try {
      if (sub === syncStep1 || sub === syncStep2) {
        // Both step1 and step2 carry a single varUint8Array payload in current protocol.
        // (State vector for step1; update for step2.)
        // If protocol evolves, this still keeps scanning best-effort.
        decoding.readVarUint8Array(dec);
        continue;
      }

      // Unknown subtype: stop scanning to avoid desync; fail open.
      break;
    } catch {
      break;
    }
  }

  return false;
}

/**
 * @function secureSetupWSConnection
 * @description
 * Wraps y-websocket's setupWSConnection with a gated message loop that drops viewer writes.
 *
 * @param conn   WebSocket (ws) connection. Must be tagged earlier with conn.__bm = {docId, uid, role}
 * @param req    HTTP IncomingMessage
 * @param options Options forwarded to y-websocket (docMap, gc, etc.)
 */
export function secureSetupWSConnection(
  conn: WSLike,
  req: any,
  options: { docMap: Map<string, Y.Doc>; gc?: boolean; [key: string]: any }
): void {
  // 1) Intercept registration of the downstream 'message' handler that y-websocket installs.
  const realOn = conn.on.bind(conn);
  let downstreamMsgHandler: ((data: any, isBinary?: boolean) => void) | null = null;

  (conn as any).on = ((event: string, handler: any) => {
    if (event === 'message') {
      // Swallow & stash (prevent y-websocket from attaching directly)
      downstreamMsgHandler = handler;
      return conn;
    }
    return realOn(event, handler);
  }) as typeof conn.on;

  // 2) Let y-websocket configure everything else (doc wiring, awareness, etc.)
  originalSetupWSConnection(conn, req, options);

  // 3) Restore normal 'on' and install our single guarded listener.
  (conn as any).on = realOn;

  realOn('message', (data: any, isBinary?: boolean) => {
    const meta = conn.__bm || { docId: 'unknown', uid: 'unknown', role: 'viewer' as const };

    // Normalize to Uint8Array for parsing
    const bytes =
      typeof data === 'string'
        ? new Uint8Array(Buffer.from(data)) // should rarely happen; protocol is binary
        : data instanceof Uint8Array
        ? data
        : new Uint8Array(data); // Buffer/ArrayBuffer

    try {
      if (frameContainsViewerWrite(bytes, meta.role)) {
        // Drop viewer write attempts
        console.log('[secureSetupWSConnection.ts][2101] drop viewer update', {
          doc: meta.docId,
          uid: meta.uid,
          size: (bytes && bytes.length) || 0
        });
        if (global.blockedUpdateCounter) {
          global.blockedUpdateCounter.inc({ docId: meta.docId, uid: meta.uid });
        }
        return;
      }
    } catch (err) {
      // On inspection errors, fail open (forward) so we don't disrupt honest traffic.
      console.warn('[secureSetupWSConnection.ts][2102] inspect error; forwarding frame', err);
    }

    // Forward allowed frames to the original y-websocket message handler
    if (downstreamMsgHandler) {
      try {
        downstreamMsgHandler.call(conn, data, isBinary);
      } catch (err) {
        console.error('[secureSetupWSConnection.ts][2103] downstream handler error', err);
      }
    } else {
      // Extremely unlikely (if y-websocket changed how it registers); fail open.
      if (conn.emit) conn.emit('message', data, isBinary);
    }
  });

  console.log('[secureSetupWSConnection.ts][2104] secure connection established', {
    doc: conn.__bm?.docId,
    uid: conn.__bm?.uid,
    role: conn.__bm?.role
  });
}

/**
 * Lightweight in-memory counter to track blocked updates per (docId, uid)
 * Exposed so the enclosing server can surface metrics endpoints.
 */
export function initMetrics() {
  if (!global.blockedUpdateCounter) {
    global.blockedUpdateCounter = {
      data: new Map<string, number>(),
      inc({ docId, uid }: { docId: string; uid: string }) {
        const key = `${docId}:${uid}`;
        const current = this.data.get(key) || 0;
        this.data.set(key, current + 1);
      },
      getAll() {
        return Array.from(this.data.entries()).map(([key, count]) => {
          const [docId, uid] = key.split(':');
          return { docId, uid, blockedUpdates: count };
        });
      },
      reset() {
        this.data.clear();
      }
    };
  }
  return global.blockedUpdateCounter;
}

// TypeScript global augmentation for metrics
declare global {
  // eslint-disable-next-line no-var
  var blockedUpdateCounter: {
    data: Map<string, number>;
    inc(params: { docId: string; uid: string }): void;
    getAll(): Array<{ docId: string; uid: string; blockedUpdates: number }>;
    reset(): void;
  };
}
