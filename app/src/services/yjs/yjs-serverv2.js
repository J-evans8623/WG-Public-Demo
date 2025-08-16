/**
 * @file yjs-serverv2.js
 * @description
 *   Production Yjs WebSocket server with ENHANCED LOGGING for debugging connection issues.
 *   Added comprehensive logging at every step to track connection attempts, failures, and reasons.
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
const REDIS_URL = process.env.REDIS_URL || '';
const JWT_PUBLIC_PATH = process.env.JWT_PUBLIC_PATH || './keys/jwt_public.pem';
const REVOKE_API_KEY = process.env.REVOKE_API_KEY || '';

// ────────────────────────────────────────────────────────────────────────────
// ENHANCED STARTUP LOGGING
// ────────────────────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════════');
console.log('[yjs-server.js][STARTUP] › YJS Server v2 Starting...');
console.log('[yjs-server.js][STARTUP] › Port:', PORT);
console.log('[yjs-server.js][STARTUP] › Redis URL:', REDIS_URL || 'NOT SET (single instance mode)');
console.log('[yjs-server.js][STARTUP] › JWT Public Key Path:', JWT_PUBLIC_PATH);
console.log('[yjs-server.js][STARTUP] › Current Working Directory:', process.cwd());
console.log('═══════════════════════════════════════════════════════════════');

// Load public key with detailed error handling
let publicKey;
try {
  const keyPath = path.resolve(JWT_PUBLIC_PATH);
  console.log('[yjs-server.js][JWT] › Attempting to load public key from:', keyPath);
  console.log('[yjs-server.js][JWT] › Key file exists:', fs.existsSync(keyPath));
  
  if (!fs.existsSync(keyPath)) {
    console.error('[yjs-server.js][JWT] › ❌ PUBLIC KEY FILE NOT FOUND!');
    console.error('[yjs-server.js][JWT] › Expected at:', keyPath);
    console.error('[yjs-server.js][JWT] › Available files in directory:');
    const dir = path.dirname(keyPath);
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach(file => {
        console.error('[yjs-server.js][JWT] ›   -', file);
      });
    } else {
      console.error('[yjs-server.js][JWT] › Directory does not exist:', dir);
    }
    process.exit(1);
  }
  
  publicKey = fs.readFileSync(keyPath, 'utf8');
  console.log('[yjs-server.js][JWT] › ✅ Public key loaded successfully');
  console.log('[yjs-server.js][JWT] › Key preview:', publicKey.substring(0, 500) + '...');
} catch (error) {
  console.error('[yjs-server.js][JWT] › ❌ Failed to load public key:', error.message);
  process.exit(1);
}

// Initialize metrics
const blockedUpdateMetrics = initMetrics();
console.log('[yjs-server.js][METRICS] › ✅ Blocked update metrics initialized');

// ────────────────────────────────────────────────────────────────────────────
// REDIS SETUP WITH ENHANCED LOGGING
// ────────────────────────────────────────────────────────────────────────────
let pubClient = null;
let subClient = null;

async function initRedisIfConfigured() {
  if (!REDIS_URL) {
    console.log('[yjs-server.js][REDIS] › ⚠️ REDIS_URL not set; running single-instance mode');
    return;
  }
  
  console.log('[yjs-server.js][REDIS] › Connecting to Redis at:', REDIS_URL);
  
  try {
    pubClient = createClient({ url: REDIS_URL });
    subClient = pubClient.duplicate();
    
    pubClient.on('error', (e) => console.error('[yjs-server.js][REDIS] › ❌ Pub client error:', e));
    subClient.on('error', (e) => console.error('[yjs-server.js][REDIS] › ❌ Sub client error:', e));
    
    pubClient.on('connect', () => console.log('[yjs-server.js][REDIS] › ✅ Pub client connected'));
    subClient.on('connect', () => console.log('[yjs-server.js][REDIS] › ✅ Sub client connected'));
    
    await pubClient.connect();
    await subClient.connect();
    console.log('[yjs-server.js][REDIS] › ✅ Redis connection established');

    // Subscribe to revocation channels
    await subClient.pSubscribe('revoke:user:*', (message, channel) => {
      const [, , docId, uid] = channel.split(':');
      console.log('[yjs-server.js][REDIS] › 📨 Revoke user received:', { docId, uid, channel });
      revokeUserLocal(docId, uid, 'redis-bus');
    });

    await subClient.pSubscribe('revoke:all_non_owner:*', (_message, channel) => {
      const [, , docId] = channel.split(':');
      console.log('[yjs-server.js][REDIS] › 📨 Revoke all non-owner received:', { docId, channel });
      revokeAllNonOwnerLocal(docId, 'redis-bus');
    });
    
    console.log('[yjs-server.js][REDIS] › ✅ Subscribed to revocation channels');
  } catch (error) {
    console.error('[yjs-server.js][REDIS] › ❌ Redis initialization failed:', error);
    console.error('[yjs-server.js][REDIS] › Continuing in single-instance mode...');
  }
}

initRedisIfConfigured();

// ────────────────────────────────────────────────────────────────────────────
// YJS DOCUMENT MANAGEMENT
// ────────────────────────────────────────────────────────────────────────────
const docs = new Map();
const listened = new WeakSet();
const docMap = docs;

// Enhanced document tracking
const originalSet = docMap.set.bind(docMap);
docMap.set = (docName, doc) => {
  console.log('[yjs-server.js][DOC] › 📄 Creating/accessing document:', docName);
  
  if (!listened.has(doc)) {
    listened.add(doc);
    doc.on('update', (update, origin) => {
      console.log('[yjs-server.js][DOC] › 📝 Document update:', {
        docName,
        updateSize: update.length,
        origin,
        willPropagate: origin !== 'redis' && !!pubClient
      });
      
      if (origin !== 'redis' && pubClient) {
        const b64 = Buffer.from(update).toString('base64');
        pubClient.publish(`yjs-doc:${docName}`, b64);
      }
    });
    console.log('[yjs-server.js][DOC] › ✅ Document update listener attached:', docName);
  }
  
  return originalSet(docName, doc);
};

// Cross-instance update propagation
if (subClient) {
  subClient.pSubscribe?.('yjs-doc:*', (message, channel) => {
    const docName = channel.split('yjs-doc:')[1];
    console.log('[yjs-server.js][DOC] › 📨 Received cross-instance update:', { docName, messageSize: message.length });
    
    const doc = docMap.get(docName);
    if (!doc) {
      console.log('[yjs-server.js][DOC] › ⚠️ Document not found locally:', docName);
      return;
    }
    
    const update = Uint8Array.from(Buffer.from(message, 'base64'));
    Y.applyUpdate(doc, update, 'redis');
    console.log('[yjs-server.js][DOC] › ✅ Applied cross-instance update:', docName);
  });
}

// ────────────────────────────────────────────────────────────────────────────
// CONNECTION TRACKING WITH ENHANCED LOGGING
// ────────────────────────────────────────────────────────────────────────────
const perDoc = new Map();
const perDocUser = new Map();

function trackSocket(docId, uid, role, ws) {
  console.log('[yjs-server.js][TRACK] › 📌 Tracking new socket:', { docId, uid, role });
  
  if (!perDoc.has(docId)) {
    perDoc.set(docId, new Set());
    console.log('[yjs-server.js][TRACK] › 📄 Created new document tracking for:', docId);
  }
  perDoc.get(docId).add(ws);

  if (!perDocUser.has(docId)) {
    perDocUser.set(docId, new Map());
    console.log('[yjs-server.js][TRACK] › 👥 Created new user tracking for doc:', docId);
  }
  
  const docUsers = perDocUser.get(docId);
  if (!docUsers.has(uid)) {
    docUsers.set(uid, new Set());
    console.log('[yjs-server.js][TRACK] › 👤 Created new user tracking:', { docId, uid });
  }
  docUsers.get(uid).add(ws);

  ws.__bm = { docId, uid, role };
  
  const totalDocConnections = perDoc.get(docId).size;
  const totalUserConnections = docUsers.get(uid).size;
  
  console.log('[yjs-server.js][TRACK] › ✅ Socket tracked successfully:', {
    docId,
    uid,
    role,
    totalDocConnections,
    totalUserConnections,
    totalDocs: perDoc.size
  });
}

function untrackSocket(ws) {
  const meta = ws.__bm;
  if (!meta) {
    console.log('[yjs-server.js][UNTRACK] › ⚠️ Attempting to untrack socket without metadata');
    return;
  }
  
  const { docId, uid, role } = meta;
  console.log('[yjs-server.js][UNTRACK] › 📌 Untracking socket:', { docId, uid, role });

  const setDoc = perDoc.get(docId);
  if (setDoc) {
    setDoc.delete(ws);
    console.log('[yjs-server.js][UNTRACK] › Removed from doc set, remaining:', setDoc.size);
  }
  
  const byUser = perDocUser.get(docId);
  if (byUser) {
    const setUser = byUser.get(uid);
    if (setUser) {
      setUser.delete(ws);
      console.log('[yjs-server.js][UNTRACK] › Removed from user set, remaining:', setUser.size);
      
      if (setUser.size === 0) {
        byUser.delete(uid);
        console.log('[yjs-server.js][UNTRACK] › 👤 User has no more connections, removed:', uid);
      }
    }
  }
  
  if (setDoc && setDoc.size === 0) {
    perDoc.delete(docId);
    console.log('[yjs-server.js][UNTRACK] › 📄 Document has no more connections, removed:', docId);
  }
  
  if (byUser && byUser.size === 0) {
    perDocUser.delete(docId);
    console.log('[yjs-server.js][UNTRACK] › 👥 Document user tracking removed:', docId);
  }
  
  console.log('[yjs-server.js][UNTRACK] › ✅ Socket untracked successfully');
}

function revokeUserLocal(docId, uid, reason = 'local') {
  console.log('[yjs-server.js][REVOKE] › 🚫 Revoking user access:', { docId, uid, reason });
  
  const users = perDocUser.get(docId);
  if (!users) {
    console.log('[yjs-server.js][REVOKE] › ⚠️ No user tracking found for doc:', docId);
    return;
  }
  
  const setUser = users.get(uid);
  if (!setUser || setUser.size === 0) {
    console.log('[yjs-server.js][REVOKE] › ⚠️ No sockets found for user:', { docId, uid });
    return;
  }
  
  console.log('[yjs-server.js][REVOKE] › 🔌 Closing sockets:', { docId, uid, count: setUser.size, reason });
  
  for (const ws of Array.from(setUser)) {
    try {
      ws.close(4003, 'FORBIDDEN');
      console.log('[yjs-server.js][REVOKE] › ✅ Socket closed successfully');
    } catch (error) {
      console.error('[yjs-server.js][REVOKE] › ❌ Error closing socket:', error.message);
    }
    untrackSocket(ws);
  }
  
  console.log('[yjs-server.js][REVOKE] › ✅ User revocation completed:', { docId, uid });
}

function revokeAllNonOwnerLocal(docId, reason = 'local') {
  console.log('[yjs-server.js][REVOKE] › 🚫 Revoking all non-owner access for doc:', { docId, reason });
  
  const setDoc = perDoc.get(docId);
  if (!setDoc || setDoc.size === 0) {
    console.log('[yjs-server.js][REVOKE] › ⚠️ No sockets found for doc:', docId);
    return;
  }
  
  let closed = 0;
  for (const ws of Array.from(setDoc)) {
    const role = ws.__bm?.role || 'viewer';
    console.log('[yjs-server.js][REVOKE] › Checking socket role:', { role, isOwner: role === 'owner' });
    
    if (role !== 'owner') {
      try {
        ws.close(4003, 'FORBIDDEN');
        console.log('[yjs-server.js][REVOKE] › ✅ Non-owner socket closed:', role);
        closed++;
      } catch (error) {
        console.error('[yjs-server.js][REVOKE] › ❌ Error closing socket:', error.message);
      }
      untrackSocket(ws);
    } else {
      console.log('[yjs-server.js][REVOKE] › 👑 Keeping owner socket open');
    }
  }
  
  console.log('[yjs-server.js][REVOKE] › ✅ Non-owner revocation completed:', { docId, closed, reason });
}

// ────────────────────────────────────────────────────────────────────────────
// HTTP SERVER WITH ENHANCED LOGGING
// ────────────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url || '/', true);
  const clientIp = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  
  console.log('[yjs-server.js][HTTP] › 🌐 HTTP Request:', {
    method: req.method,
    pathname,
    clientIp,
    userAgent: req.headers['user-agent']?.substring(0, 100)
  });

  // Health check endpoint
  if (req.method === 'GET' && pathname === '/healthz') {
    console.log('[yjs-server.js][HTTP] › ✅ Health check requested');
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }

  // Metrics endpoint
  if (req.method === 'GET' && pathname === '/metrics/blocked-updates') {
    console.log('[yjs-server.js][HTTP] › 📊 Metrics requested');
    const metrics = blockedUpdateMetrics.getAll();
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      totalBlockedSockets: metrics.length,
      details: metrics,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Reset metrics endpoint
  if (req.method === 'POST' && pathname === '/metrics/reset') {
    console.log('[yjs-server.js][HTTP] › 🔄 Metrics reset requested');
    if (!REVOKE_API_KEY || req.headers['x-api-key'] !== REVOKE_API_KEY) {
      console.warn('[yjs-server.js][HTTP] › ❌ Unauthorized metrics reset attempt');
      res.writeHead(401).end('unauthorized');
      return;
    }
    blockedUpdateMetrics.reset();
    console.log('[yjs-server.js][HTTP] › ✅ Metrics reset completed');
    res.writeHead(204).end();
    return;
  }

  // Revoke endpoint
  if (req.method === 'POST' && pathname === '/revoke') {
    console.log('[yjs-server.js][HTTP] › 🚫 Revoke request received');
    if (!REVOKE_API_KEY || req.headers['x-api-key'] !== REVOKE_API_KEY) {
      console.warn('[yjs-server.js][HTTP] › ❌ Unauthorized revoke attempt');
      res.writeHead(401).end('unauthorized');
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      console.log('[yjs-server.js][HTTP] › 📝 Revoke request data chunk received:', chunk.length);
    });
    
    req.on('end', async () => {
      console.log('[yjs-server.js][HTTP] › 📝 Revoke request complete, body:', body);
      
      try {
        const payload = JSON.parse(body || '{}');
        const { type, docId, uid } = payload || {};
        
        console.log('[yjs-server.js][HTTP] › 🔍 Revoke payload parsed:', { type, docId, uid });
        
        if (type !== 'user' && type !== 'all_non_owner') {
          console.warn('[yjs-server.js][HTTP] › ❌ Invalid revoke type:', type);
          res.writeHead(400).end('invalid type');
          return;
        }
        
        if (!docId || (type === 'user' && !uid)) {
          console.warn('[yjs-server.js][HTTP] › ❌ Missing revoke parameters:', { docId, uid, type });
          res.writeHead(400).end('missing params');
          return;
        }

        // Execute revocation locally
        if (type === 'user') {
          revokeUserLocal(docId, uid, 'http-api');
        } else {
          revokeAllNonOwnerLocal(docId, 'http-api');
        }

        // Propagate via Redis if available
        if (pubClient) {
          const channel = type === 'user'
            ? `revoke:user:${docId}:${uid}`
            : `revoke:all_non_owner:${docId}`;
          
          console.log('[yjs-server.js][HTTP] › 📡 Publishing revoke to Redis:', channel);
          await pubClient.publish(channel, '1');
          console.log('[yjs-server.js][HTTP] › ✅ Revoke published to Redis');
        } else {
          console.log('[yjs-server.js][HTTP] › ⚠️ No Redis client, local revoke only');
        }

        console.log('[yjs-server.js][HTTP] › ✅ Revoke request completed successfully');
        res.writeHead(204).end();
      } catch (error) {
        console.error('[yjs-server.js][HTTP] › ❌ Revoke request error:', error);
        res.writeHead(500).end('error');
      }
    });
    return;
  }

  // Fallback 404
  console.log('[yjs-server.js][HTTP] › ❌ Not found:', pathname);
  res.writeHead(404).end('not found');
});

// ────────────────────────────────────────────────────────────────────────────
// WEBSOCKET SERVER WITH COMPREHENSIVE LOGGING
// ────────────────────────────────────────────────────────────────────────────
const wss = new WebSocket.Server({ 
  server,
  verifyClient: (info) => {
    const clientIp = info.req.connection.remoteAddress || 'unknown';
    console.log('[yjs-server.js][WS] › 🔍 WebSocket connection attempt from:', clientIp);
    console.log('[yjs-server.js][WS] › 🔍 Headers:', {
      origin: info.origin,
      protocol: info.req.headers['sec-websocket-protocol'],
      userAgent: info.req.headers['user-agent']?.substring(0, 100)
    });
    return true; // Allow all connections to proceed to the connection handler
  }
});

// Track connection attempts globally - ADD THIS MISSING LINE
let connectionAttemptCounter = 0;

// Replace the connection handler in yjs-serverv2.js with this:

wss.on('connection', (ws, req) => {
  const attemptId = ++connectionAttemptCounter;
  const clientIp = req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  
  console.log('🎯'.repeat(20));
  console.log(`[yjs-server.js][WS] › 🔌 CONNECTION ATTEMPT #${attemptId}`);
  console.log('[yjs-server.js][WS] › Client IP:', clientIp);
  console.log('[yjs-server.js][WS] › Request URL:', req.url);
  console.log('[yjs-server.js][WS] › Connection time:', new Date().toISOString());
  console.log('🎯'.repeat(20));

  // FIXED: Parse URL to extract docId and token from the complete URL
  let docId, token;
  try {
    const urlParts = new URL(req.url || '/', 'http://localhost');
    
    // Handle both formats:
    // 1. /docId?token=jwt (new format from fixed client)
    // 2. /docId (when token is in query only)
    const pathname = urlParts.pathname;
    
    if (pathname === '/') {
      // If pathname is just '/', the docId might be in the URL differently
      // This handles edge cases
      console.error(`[yjs-server.js][WS] › ❌ ATTEMPT #${attemptId}: Invalid URL format - no document path`);
      ws.close(4002, 'INVALID_URL_FORMAT');
      return;
    }
    
    // Extract docId from pathname (remove leading slash)
    docId = decodeURIComponent(pathname.slice(1));
    
    // Extract token from query parameters
    token = urlParts.searchParams.get('token');
    
    console.log('[yjs-server.js][WS] › 🔍 Parsed URL:', {
      originalUrl: req.url,
      pathname: urlParts.pathname,
      docId: docId,
      hasToken: !!token,
      tokenLength: token?.length || 0
    });
    
    // Validate both docId and token are present
    if (!docId || docId === '') {
      console.error(`[yjs-server.js][WS] › ❌ ATTEMPT #${attemptId}: Empty document ID`);
      ws.close(4002, 'MISSING_DOC_ID');
      return;
    }
    
    if (!token || token === '') {
      console.error(`[yjs-server.js][WS] › ❌ ATTEMPT #${attemptId}: Missing token in query parameters`);
      ws.close(4002, 'MISSING_TOKEN');
      return;
    }
    
  } catch (urlError) {
    console.error(`[yjs-server.js][WS] › ❌ ATTEMPT #${attemptId}: URL parsing failed:`, {
      error: urlError.message,
      url: req.url
    });
    ws.close(4002, 'INVALID_URL');
    return;
  }

  // Log headers for debugging
  console.log('[yjs-server.js][WS] › 📋 Request headers:');
  Object.entries(req.headers).forEach(([key, value]) => {
    // Don't log the full token in headers if it's there
    if (key.toLowerCase() === 'authorization' && typeof value === 'string' && value.length > 50) {
      console.log(`[yjs-server.js][WS] ›   ${key}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`[yjs-server.js][WS] ›   ${key}: ${value}`);
    }
  });

  // Enhanced JWT verification with better error handling
  let payload = null;
  try {
    console.log(`[yjs-server.js][WS] › 🔐 ATTEMPT #${attemptId}: Verifying JWT...`);
    console.log('[yjs-server.js][WS] › 🔐 Token preview:', token.substring(0, 50) + '...');
    console.log('[yjs-server.js][WS] › 🔐 Public key preview:', publicKey.substring(0, 100));
    console.log('[yjs-server.js][WS] › 🔐 JWT algorithm check: RS256');
    console.log('[yjs-server.js][WS] › 🔐 Token length:', token.length);


    // Add this right before your JWT verification in yjs-serverv2.js
// This will help us understand exactly what's wrong with the JWT

console.log(`[yjs-server.js][WS] › 🔐 ATTEMPT #${attemptId}: Starting detailed JWT debug...`);

// 1. Check the token format
const tokenParts = token.split('.');
console.log('[yjs-server.js][WS] › 🔐 Token structure:');
console.log('[yjs-server.js][WS] › 🔐   Parts count:', tokenParts.length);
console.log('[yjs-server.js][WS] › 🔐   Header length:', tokenParts[0]?.length);
console.log('[yjs-server.js][WS] › 🔐   Payload length:', tokenParts[1]?.length);
console.log('[yjs-server.js][WS] › 🔐   Signature length:', tokenParts[2]?.length);

// 2. Try to decode the header and payload without verification
try {
  const header = JSON.parse(Buffer.from(tokenParts[0], 'base64').toString());
  console.log('[yjs-server.js][WS] › 🔐 Decoded header:', header);
} catch (headerError) {
  console.error('[yjs-server.js][WS] › 🔐 Header decode failed:', headerError.message);
}

try {
  const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
  console.log('[yjs-server.js][WS] › 🔐 Decoded payload:', payload);
  console.log('[yjs-server.js][WS] › 🔐 Token expiry:', new Date(payload.exp * 1000));
  console.log('[yjs-server.js][WS] › 🔐 Current time:', new Date());
  console.log('[yjs-server.js][WS] › 🔐 Token expired?', payload.exp * 1000 < Date.now());
} catch (payloadError) {
  console.error('[yjs-server.js][WS] › 🔐 Payload decode failed:', payloadError.message);
}

// 3. Check the public key format
console.log('[yjs-server.js][WS] › 🔐 Public key info:');
console.log('[yjs-server.js][WS] › 🔐   Length:', publicKey.length);
console.log('[yjs-server.js][WS] › 🔐   Starts with:', publicKey.substring(0, 30));
console.log('[yjs-server.js][WS] › 🔐   Ends with:', publicKey.substring(publicKey.length - 30));

// 4. Try verification with detailed error catching
try {
  console.log('[yjs-server.js][WS] › 🔐 Attempting JWT verification...');
  
  payload = jwt.verify(token, publicKey, { 
    algorithms: ['RS256'],
    clockTolerance: 30 // Allow 30 seconds clock drift
  });
  
  console.log(`[yjs-server.js][WS] › ✅ ATTEMPT #${attemptId}: JWT verification successful!`);
  console.log('[yjs-server.js][WS] › 🔐 Verified payload:', payload);

} catch (jwtError) {
  console.error(`[yjs-server.js][WS] › ❌ ATTEMPT #${attemptId}: JWT verification failed with detailed info:`);
  console.error('[yjs-server.js][WS] › 🔐 Error name:', jwtError.name);
  console.error('[yjs-server.js][WS] › 🔐 Error message:', jwtError.message);
  
  // Try different verification approaches for debugging
  const testOptions = [
    { algorithms: ['RS256'], ignoreExpiration: true },
    { algorithms: ['RS256'], ignoreNotBefore: true },
    { algorithms: ['RS256'], ignoreExpiration: true, ignoreNotBefore: true },
  ];
  
  for (let i = 0; i < testOptions.length; i++) {
    try {
      const testResult = jwt.verify(token, publicKey, testOptions[i]);
      console.log(`[yjs-server.js][WS] › 🔐 Test verification ${i + 1} SUCCESS:`, testResult);
      break;
    } catch (testError) {
      console.log(`[yjs-server.js][WS] › 🔐 Test verification ${i + 1} failed:`, testError.message);
    }
  }
  
  // Check if it's a key mismatch by trying with a different algorithm
  try {
    jwt.verify(token, publicKey, { algorithms: ['HS256'] });
    console.log('[yjs-server.js][WS] › 🔐 WARNING: Token verified with HS256 - possible algorithm mismatch!');
  } catch (hsError) {
    console.log('[yjs-server.js][WS] › 🔐 HS256 also failed (expected for RS256 tokens)');
  }
  
  ws.close(4002, 'INVALID_TOKEN');
  return;
}

    // Verify the JWT
    payload = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    console.log(`[yjs-server.js][WS] › ✅ ATTEMPT #${attemptId}: JWT verification successful`);
    console.log('[yjs-server.js][WS] › 🔐 JWT payload:', JSON.stringify(payload, null, 2));

    // Verify document ID matches
    if (payload.doc !== docId) {
      console.error(`[yjs-server.js][WS] › ❌ ATTEMPT #${attemptId}: Document ID mismatch:`, {
        tokenDoc: payload.doc,
        pathDoc: docId
      });
      ws.close(4002, 'DOC_MISMATCH');
      return;
    }
    
    console.log(`[yjs-server.js][WS] › ✅ ATTEMPT #${attemptId}: Document ID verification passed`);

  } catch (error) {
    console.error(`[yjs-server.js][WS] › ❌ ATTEMPT #${attemptId}: JWT verification failed:`, {
      error: error.message,
      errorType: error.name,
      tokenLength: token?.length || 0,
      tokenPreview: token?.substring(0, 50) || 'none',
      publicKeyExists: !!publicKey,
      publicKeyPreview: publicKey ? publicKey.substring(0, 100) : 'none',
      fullError: error.toString()
    });
    
    // More specific error codes based on JWT error type
    if (error.name === 'JsonWebTokenError') {
      ws.close(4002, 'MALFORMED_TOKEN');
    } else if (error.name === 'TokenExpiredError') {
      ws.close(4002, 'EXPIRED_TOKEN');
    } else {
      ws.close(4002, 'INVALID_TOKEN');
    }
    return;
  }

  // Extract user info and role
  const uid = String(payload.sub || '').toLowerCase();
  const roles = Array.isArray(payload.roles) ? payload.roles : [];
  const role = roles.includes('owner') ? 'owner' : roles.includes('editor') ? 'editor' : 'viewer';

  console.log(`[yjs-server.js][WS] › 👤 ATTEMPT #${attemptId}: User authentication successful:`, {
    uid,
    roles,
    finalRole: role,
    docId
  });

  // Track the socket
  trackSocket(docId, uid, role, ws);

  // Enhanced close handler
  ws.on('close', (code, reason) => {
    console.log(`[yjs-server.js][WS] › 🔌 ATTEMPT #${attemptId}: Connection closed:`, {
      docId,
      uid,
      role,
      code,
      reason: reason?.toString(),
      clientIp,
      duration: `${Date.now() - ws.connectTime}ms`
    });
    untrackSocket(ws);
  });

  // Enhanced error handler
  ws.on('error', (error) => {
    console.error(`[yjs-server.js][WS] › ❌ ATTEMPT #${attemptId}: WebSocket error:`, {
      docId,
      uid,
      role,
      error: error.message,
      clientIp
    });
  });

  // Store connection time for duration calculation
  ws.connectTime = Date.now();

  // Set up the secure Yjs connection
  try {
    console.log(`[yjs-server.js][WS] › 🔧 ATTEMPT #${attemptId}: Setting up secure Yjs connection...`);
    secureSetupWSConnection(ws, req, { docMap, gc: true });
    console.log(`[yjs-server.js][WS] › ✅ ATTEMPT #${attemptId}: Secure Yjs connection established`);
  } catch (error) {
    console.error(`[yjs-server.js][WS] › ❌ ATTEMPT #${attemptId}: Failed to setup secure connection:`, error);
    ws.close(1011, 'SETUP_FAILED');
    return;
  }

  // Final success log
  console.log('🎉'.repeat(20));
  console.log(`[yjs-server.js][WS] › 🎉 ATTEMPT #${attemptId}: CONNECTION SUCCESSFUL!`);
  console.log('[yjs-server.js][WS] › User:', uid);
  console.log('[yjs-server.js][WS] › Role:', role);
  console.log('[yjs-server.js][WS] › Document:', docId);
  console.log('[yjs-server.js][WS] › Total connections for this doc:', perDoc.get(docId)?.size || 0);
  console.log('[yjs-server.js][WS] › Total active documents:', perDoc.size);
  console.log('[yjs-server.js][WS] › Server uptime:', Math.floor(process.uptime()), 'seconds');
  console.log('🎉'.repeat(20));
});

// Enhanced server startup logging
server.on('listening', () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('[yjs-server.js][SERVER] › 🚀 YJS SERVER SUCCESSFULLY STARTED!');
  console.log('[yjs-server.js][SERVER] › HTTP server listening on port:', PORT);
  console.log('[yjs-server.js][SERVER] › WebSocket server ready for connections');
  console.log('[yjs-server.js][SERVER] › Health check URL: http://localhost:' + PORT + '/healthz');
  console.log('[yjs-server.js][SERVER] › WebSocket URL: ws://localhost:' + PORT + '/<docId>');
  console.log('[yjs-server.js][SERVER] › Ready to accept connections! 🎉');
  console.log('═══════════════════════════════════════════════════════════════');
});

server.on('error', (error) => {
  console.error('═══════════════════════════════════════════════════════════════');
  console.error('[yjs-server.js][SERVER] › ❌ SERVER ERROR:', error);
  console.error('═══════════════════════════════════════════════════════════════');
});

// Periodic metrics logging
setInterval(() => {
  const metrics = blockedUpdateMetrics.getAll();
  const totalConnections = Array.from(perDoc.values()).reduce((sum, set) => sum + set.size, 0);
  
  console.log('[yjs-server.js][METRICS] › 📊 Server status:', {
    totalConnections,
    activeDocs: perDoc.size,
    blockedUpdates: metrics.length,
    timestamp: new Date().toISOString()
  });
  
  if (metrics.length > 0) {
    console.log('[yjs-server.js][METRICS] › 🚫 Blocked updates summary:', {
      totalBlockedSockets: metrics.length,
      totalBlockedAttempts: metrics.reduce((sum, m) => sum + m.blockedUpdates, 0),
      topOffenders: metrics
        .sort((a, b) => b.blockedUpdates - a.blockedUpdates)
        .slice(0, 5)
    });
  }
}, 5 * 60 * 1000); // 5 minutes

// Start the server
server.listen(PORT, () => {
  // The 'listening' event handler above will log the success message
});