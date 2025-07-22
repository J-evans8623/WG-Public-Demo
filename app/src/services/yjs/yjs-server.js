/** 
 * @file yjs-server.js
 * @responsibility
 *   • Handle WebSocket connections using the official Y-Websocket frame protocol.
 *   • Use Redis pub/sub (one channel per document) to sync updates across server instances.
 *   • Maintain an in-memory Map of Y.Doc instances (docMap).
 *   • **New:** Load RS256 public key and log JWT verification on each incoming WS.
 */

const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const Y = require('yjs');
const { setupWSConnection } = require('y-websocket/bin/utils');
const { createClient } = require('redis');
const yargs = require('yargs');

// ---- CLI / ENV args ----
const argv = yargs(process.argv.slice(2))
  .option('port', {
    alias: 'p',
    type: 'number',
    description: 'Server listening port',
    default: parseInt(process.env.PORT, 10) || 1234
  })
  .option('redis-url', {
    alias: 'r',
    type: 'string',
    description: 'Redis connection URL',
    default: process.env.REDIS_URL || 'redis://localhost:6379'
  })
  .argv;

const PORT = argv.port;
const REDIS_URL = argv['redis-url'];

// ---- Load RS256 public key ----
const publicKeyPath = process.env.JWT_PUBLIC_PATH;
console.log('yjs-server.js 4001 › Loading public key from', publicKeyPath);
const publicKey = fs.readFileSync(path.resolve(__dirname, publicKeyPath), 'utf8');
console.log('yjs-server.js 4002 › Public key loaded successfully');

// ---- Redis setup ----
const pubClient = createClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();
pubClient.on('error', err => console.error('yjs-server.js 4003 › Redis pub error:', err));
subClient.on('error', err => console.error('yjs-server.js 4004 › Redis sub error:', err));

;(async () => {
  await pubClient.connect();
  await subClient.connect();
  console.log('yjs-server.js 4005 › Connected to Redis at', REDIS_URL);

  // Subscribe to updates from other server instances
  await subClient.pSubscribe('yjs-doc:*', (message, channel) => {
    const docName = channel.split('yjs-doc:')[1];
    const doc = docMap.get(docName);
    if (!doc) return;

    const update = Uint8Array.from(Buffer.from(message, 'base64'));
    Y.applyUpdate(doc, update, 'redis');
  });
})();

// ---- In-memory docs with Redis listeners ----
const docs = new Map();
const listened = new WeakSet();
const docMap = docs;
const originalSet = docMap.set.bind(docMap);
docMap.set = (docName, doc) => {
  if (!listened.has(doc)) {
    listened.add(doc);
    doc.on('update', (update, origin) => {
      if (origin !== 'redis') {
        const b64 = Buffer.from(update).toString('base64');
        pubClient.publish(`yjs-doc:${docName}`, b64);
      }
    });
  }
  return originalSet(docName, doc);
};

// ---- HTTP + WebSocket server ----
const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  const urlPath = req.url || '/';
  const docName = urlPath.slice(1);

  // Extract token from Sec-WebSocket-Protocol
  const protocols = req.headers['sec-websocket-protocol'];
  console.log('yjs-server.js 4006 › Sec-WebSocket-Protocol header:', protocols);
  let token;
  if (typeof protocols === 'string') {
    const parts = protocols.split(',');
    if (parts[0] === 'token' && parts[1]) {
      token = parts[1].trim();
    }
  }
  console.log('yjs-server.js 4007 › Extracted token:', token);

  // Verify signature only and log payload
  if (token) {
    try {
      const payload = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
      console.log('yjs-server.js 4008 › JWT verified payload=', payload);
    } catch (err) {
      console.error('yjs-server.js 4009 › JWT verification failed:', err);
      ws.close(4002, 'Invalid token');
      return;
    }
  } else {
    console.log('yjs-server.js 4010 › No token provided, proceeding without JWT');
  }

  // Hand off to Y-WebSocket handler
  setupWSConnection(ws, req, { docMap, gc: true });
});

server.listen(PORT, () => {
  console.log(`yjs-server.js 4011 › Yjs server listening on port ${PORT}`);
});
