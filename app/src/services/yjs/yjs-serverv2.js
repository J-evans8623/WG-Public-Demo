/**
 * @file yjs-serverv2.js
 * @description
 *   Production Yjs WebSocket server with server-enforced read-only access control and an 
 *   embedded "revocation bus" that is both:
 *     1) a Redis pub/sub subscriber (to fan-out revokes across replicas), and
 *     2) an HTTP publisher endpoint (/revoke) so serverless BFFs can trigger revokes
 *        without holding a Redis client.
 *
 *   Key capabilities:
 *   - Verifies RS256 JWT passed in Sec-WebSocket-Protocol (token,<jwt>).
 *   - Enforces read-only access at the server level for viewer sockets.
 *   - Tracks live sockets by docId and (docId, uid) for targeted disconnect.
 *   - Subscribes to:
 *       revoke:user:{docId}:{uid}
 *       revoke:all_non_owner:{docId}
 *     and closes matching sockets with code 4003.
 *   - Exposes POST /revoke (with X-API-Key) to publish revocations to Redis and
 *     immediately close local sockets as well (lowest latency).
 *   - Provides metrics endpoints for blocked update monitoring.
 *
 *   Notes on cost:
 *   - Only a single Redis is needed for multi-replica fan-out. If you run just one
 *     Yjs replica, you can even comment out the Redis lines and rely solely on the
 *     in-process registry (zero extra infra cost).
 *
 * Logging:
 *   Purposeful console logs carry file tag + stable 4-digit codes (46xx range).
 */

const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const Y = require('yjs');
const { secureSetupWSConnection, initMetrics } = require('./yws/secureSetupWSConnection');
const { createClient } = require('redis');
const url = require('url');

// ────────────────────────────────────────────────────────────────────────────
// ENV
// ────────────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '1234', 10);
const REDIS_URL = process.env.REDIS_URL || ''; // optional if single replica
const JWT_PUBLIC_PATH = process.env.JWT_PUBLIC_PATH || './keys/jwt_public.pem';
const REVOKE_API_KEY = process.env.REVOKE_API_KEY || ''; // HTTP publisher auth

// ────────────────────────────────────────────────────────────────────────────
console.log('[yjs-server.js][4601] › Starting Yjs server on port', PORT);
const publicKey = fs.readFileSync(path.resolve(JWT_PUBLIC_PATH), 'utf8');
console.log('[yjs-server.js][4602] › Public key loaded from', JWT_PUBLIC_PATH);

// Initialize metrics for tracking blocked updates
const blockedUpdateMetrics = initMetrics();
console.log('[yjs-server.js][4630] › Initialized blocked update metrics');

// ────────────────────────────────────────────────────────────────────────────
// Optional Redis (enable if you run >1 Yjs replica)
// ────────────────────────────────────────────────────────────────────────────
let pubClient = null;
let subClient = null;

async function initRedisIfConfigured() {
  if (!REDIS_URL) {
    console.log('[yjs-server.js][4603] › REDIS_URL not set; running single-instance mode (no pub/sub)');
    return;
  }
  pubClient = createClient({ url: REDIS_URL });
  subClient = pubClient.duplicate();
  pubClient.on('error', (e) => console.error('[yjs-server.js][4604] › Redis pub error', e));
  subClient.on('error', (e) => console.error('[yjs-server.js][4605] › Redis sub error', e));
  await pubClient.connect();
  await subClient.connect();
  console.log('[yjs-server.js][4606] › Connected to Redis at', REDIS_URL);

  // Subscribe to revocation channels (pattern)
  await subClient.pSubscribe('revoke:user:*', (message, channel) => {
    const [, , docId, uid] = channel.split(':'); // revoke:user:{docId}:{uid}
    console.log('[yjs-server.js][4607] › Redis revoke:user received', { docId, uid });
    revokeUserLocal(docId, uid, 'bus');
  });

  await subClient.pSubscribe('revoke:all_non_owner:*', (_message, channel) => {
    const [, , docId] = channel.split(':'); // revoke:all_non_owner:{docId}
    console.log('[yjs-server.js][4608] › Redis revoke:all_non_owner received', { docId });
    revokeAllNonOwnerLocal(docId, 'bus');
  });
}
initRedisIfConfigured().catch((e) => {
  console.error('[yjs-server.js][4699] › Redis init failed; continuing single-instance:', e);
});

// ────────────────────────────────────────────────────────────────────────────
// Yjs doc map + cross-instance update propagation (optional Redis)
// ────────────────────────────────────────────────────────────────────────────
const docs = new Map();
const listened = new WeakSet();
const docMap = docs;
const originalSet = docMap.set.bind(docMap);
docMap.set = (docName, doc) => {
  if (!listened.has(doc)) {
    listened.add(doc);
    doc.on('update', (update, origin) => {
      if (origin !== 'redis' && pubClient) {
        const b64 = Buffer.from(update).toString('base64');
        pubClient.publish(`yjs-doc:${docName}`, b64);
      }
    });
  }
  return originalSet(docName, doc);
};

// Optional: receive cross-instance yjs updates
if (subClient) {
  subClient.pSubscribe?.('yjs-doc:*', (message, channel) => {
    const docName = channel.split('yjs-doc:')[1];
    const doc = docMap.get(docName);
    if (!doc) return;
    const update = Uint8Array.from(Buffer.from(message, 'base64'));
    Y.applyUpdate(doc, update, 'redis');
  });
}

// ────────────────────────────────────────────────────────────────────────────
/**
 * Connection registry for targeted revocation.
 *   perDoc:          docId -> Set<WebSocket>
 *   perDocUser:      docId -> (uid -> Set<WebSocket>)
 */
const perDoc = new Map();
const perDocUser = new Map();

/** Register a new socket */
function trackSocket(docId, uid, role, ws) {
  if (!perDoc.has(docId)) perDoc.set(docId, new Set());
  perDoc.get(docId).add(ws);

  if (!perDocUser.has(docId)) perDocUser.set(docId, new Map());
  const m = perDocUser.get(docId);
  if (!m.has(uid)) m.set(uid, new Set());
  m.get(uid).add(ws);

  ws.__bm = { docId, uid, role };
  console.log('[yjs-server.js][4610] › trackSocket', { docId, uid, role, docCount: perDoc.get(docId).size });
}

/** Remove a socket from the registry */
function untrackSocket(ws) {
  const meta = ws.__bm;
  if (!meta) return;
  const { docId, uid } = meta;

  const setDoc = perDoc.get(docId);
  if (setDoc) setDoc.delete(ws);
  const byUser = perDocUser.get(docId);
  if (byUser) {
    const setUser = byUser.get(uid);
    if (setUser) {
      setUser.delete(ws);
      if (setUser.size === 0) byUser.delete(uid);
    }
  }
  if (setDoc && setDoc.size === 0) perDoc.delete(docId);
  if (byUser && byUser.size === 0) perDocUser.delete(docId);
}

/** Close sockets for a user in a doc (local only) */
function revokeUserLocal(docId, uid, reason = 'local') {
  const users = perDocUser.get(docId);
  const setUser = users?.get(uid);
  if (!setUser || setUser.size === 0) {
    console.log('[yjs-server.js][4611] › revokeUserLocal no sockets', { docId, uid, reason });
    return;
  }
  console.log('[yjs-server.js][4612] › revokeUserLocal closing', { docId, uid, count: setUser.size, reason });
  for (const ws of Array.from(setUser)) {
    try { ws.close(4003, 'FORBIDDEN'); } catch {}
    untrackSocket(ws);
  }
}

/** Close all non-owner sockets in a doc (local only) */
function revokeAllNonOwnerLocal(docId, reason = 'local') {
  const setDoc = perDoc.get(docId);
  if (!setDoc || setDoc.size === 0) {
    console.log('[yjs-server.js][4613] › revokeAllNonOwnerLocal no sockets', { docId, reason });
    return;
  }
  let closed = 0;
  for (const ws of Array.from(setDoc)) {
    const role = ws.__bm?.role || 'viewer';
    if (role !== 'owner') {
      try { ws.close(4003, 'FORBIDDEN'); } catch {}
      untrackSocket(ws);
      closed++;
    }
  }
  console.log('[yjs-server.js][4614] › revokeAllNonOwnerLocal closed', { docId, closed, reason });
}

// ────────────────────────────────────────────────────────────────────────────
// HTTP + WS server
// ────────────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url || '/', true);

  // Health
  if (req.method === 'GET' && pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }

  // Metrics endpoint for blocked updates
  if (req.method === 'GET' && pathname === '/metrics/blocked-updates') {
    const metrics = blockedUpdateMetrics.getAll();
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      totalBlockedSockets: metrics.length,
      details: metrics,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Reset metrics endpoint (for testing/debugging)
  if (req.method === 'POST' && pathname === '/metrics/reset') {
    if (!REVOKE_API_KEY || req.headers['x-api-key'] !== REVOKE_API_KEY) {
      res.writeHead(401).end('unauthorized');
      return;
    }
    blockedUpdateMetrics.reset();
    console.log('[yjs-server.js][4632] › Metrics reset');
    res.writeHead(204).end();
    return;
  }

  // Publisher endpoint: POST /revoke  { type, docId, uid? }
  if (req.method === 'POST' && pathname === '/revoke') {
    if (!REVOKE_API_KEY || req.headers['x-api-key'] !== REVOKE_API_KEY) {
      console.warn('[yjs-server.js][4615] › /revoke unauthorized');
      res.writeHead(401).end('unauthorized');
      return;
    }

    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { type, docId, uid } = payload || {};
        if (type !== 'user' && type !== 'all_non_owner') {
          res.writeHead(400).end('invalid type');
          return;
        }
        if (!docId || (type === 'user' && !uid)) {
          res.writeHead(400).end('missing params');
          return;
        }

        // 1) Close local sockets immediately
        if (type === 'user') revokeUserLocal(docId, uid, 'http');
        else revokeAllNonOwnerLocal(docId, 'http');

        // 2) Fan-out to other replicas via Redis
        if (pubClient) {
          const channel =
            type === 'user'
              ? `revoke:user:${docId}:${uid}`
              : `revoke:all_non_owner:${docId}`;
          await pubClient.publish(channel, '1');
          console.log('[yjs-server.js][4616] › /revoke published', { channel });
        } else {
          console.log('[yjs-server.js][4617] › /revoke (single-instance, no Redis publish)');
        }

        res.writeHead(204).end();
      } catch (e) {
        console.error('[yjs-server.js][4698] › /revoke error', e);
        res.writeHead(500).end('error');
      }
    });
    return;
  }

  // Fallback 404
  res.writeHead(404).end('not found');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  // Expect URL path "/<docId>"
  const docId = (req.url || '/').slice(1);

  // JWT in Sec-WebSocket-Protocol: "token,<jwt>"
  const proto = req.headers['sec-websocket-protocol'];
  let token = null;
  if (typeof proto === 'string') {
    const parts = proto.split(',');
    if (parts[0] === 'token' && parts[1]) token = parts[1].trim();
  }

  // Verify
  let payload = null;
  try {
    if (!token) throw new Error('missing token');
    payload = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    // payload: { sub, doc, roles[], exp }
    if (payload.doc !== docId) {
      console.warn('[yjs-server.js][4620] › DOC_MISMATCH', { tokenDoc: payload.doc, pathDoc: docId });
      ws.close(4002, 'DOC_MISMATCH');
      return;
    }
  } catch (e) {
    console.warn('[yjs-server.js][4621] › INVALID_TOKEN', e?.message);
    ws.close(4002, 'INVALID_TOKEN');
    return;
  }

  const uid = String(payload.sub || '').toLowerCase();
  const roles = Array.isArray(payload.roles) ? payload.roles : [];
  const role = roles.includes('owner') ? 'owner' : roles.includes('editor') ? 'editor' : 'viewer';

  // Track socket with metadata
  trackSocket(docId, uid, role, ws);

  ws.on('close', () => {
    untrackSocket(ws);
  });

  // Use secure connection handler that enforces read-only for viewers
  secureSetupWSConnection(ws, req, { docMap, gc: true });
  
  // Log successful connection with role
  console.log('[yjs-server.js][4631] › Secure connection established', {
    docId,
    uid,
    role,
    totalConnections: perDoc.get(docId)?.size || 0
  });
});

// Log blocked update metrics every 5 minutes for observability
setInterval(() => {
  const metrics = blockedUpdateMetrics.getAll();
  if (metrics.length > 0) {
    console.log('[yjs-server.js][4633] › Blocked updates summary', {
      totalBlockedSockets: metrics.length,
      totalBlockedAttempts: metrics.reduce((sum, m) => sum + m.blockedUpdates, 0),
      topOffenders: metrics
        .sort((a, b) => b.blockedUpdates - a.blockedUpdates)
        .slice(0, 5)
    });
  }
}, 5 * 60 * 1000); // 5 minutes

server.listen(PORT, () => {
  console.log('[yjs-server.js][4629] › Listening on', PORT);
});