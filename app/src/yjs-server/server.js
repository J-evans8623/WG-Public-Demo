
/** 
* @file yjs-server.js
 * @responsibility
 *   • Handle WebSocket connections using the official Y-Websocket frame protocol.
 *   • Use Redis pub/sub (one channel per document) to sync updates across server instances.
 *   • Maintain an in-memory Map of Y.Doc instances (docMap).
 */

const http = require('http');
const WebSocket = require('ws');
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

// ---- Redis setup ----
const pubClient = createClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();
pubClient.on('error', err => console.error('Redis pub error:', err));
subClient.on('error', err => console.error('Redis sub error:', err));

(async () => {
  await pubClient.connect();
  await subClient.connect();
  console.log(`Connected to Redis at ${REDIS_URL}`);

  // Subscribe to updates from other server instances
  await subClient.pSubscribe('yjs-doc:*', (message, channel) => {
    const docName = channel.split('yjs-doc:')[1];
    const doc = docMap.get(docName);
    if (!doc) return;

    // Apply incoming update with a special origin so we don't republish
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
  // Only attach once per Y.Doc
  if (!listened.has(doc)) {
    listened.add(doc);

    // On every local update, publish it to Redis
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
  // Expect URL format ws://host:port/<docName>
  const path = req.url || '/';
  // Remove leading slash
  const docName = path.slice(1);

  // Delegate to the official Y-Websocket handler
  setupWSConnection(ws, req, {
    docMap,
    gc: true
  });
});

server.listen(PORT, () => {
  console.log(`Yjs server listening on port ${PORT}`);
});
