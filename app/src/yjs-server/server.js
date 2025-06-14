/**
 * server.js
 *
 * Responsibilities:
 *   • Spin up an HTTP+WebSocket server for Yjs collaboration.
 *   • Persist and load Yjs updates via Redis (TTL 30 days).
 *   • Validate JWT signed by the Next.js BFF:
 *       – Check signature with RS256 and your public key.
 *       – Ensure payload.doc matches the requested room.
 *       – Ensure payload.roles includes 'editor'.
 *       – Extract payload.sub as the userId.
 *   • Hand off to y-websocket’s setupWSConnection with the authenticated userId.
 *   • Emit structured logs via Pino.
 */

const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const { setupWSConnection } = require('y-websocket');
const { createClient } = require('redis');
const { RedisPersistence } = require('y-redis');
const jwt = require('jsonwebtoken');
const pino = require('pino');
const config = require('./config');

const logger = pino({ level: config.logLevel });

const app = express();
app.get('/healthz', (_req, res) => res.sendStatus(200));

const server = http.createServer(app);

// Set up Redis persistence if configured
let persistence = null;
if (config.redisUrl) {
  const redisClient = createClient({ url: config.redisUrl });
  redisClient.connect().catch(err => {
    logger.error({ err }, 'Failed to connect to Redis, exiting');
    process.exit(1);
  });
  persistence = new RedisPersistence(redisClient, { ttl: 30 * 24 * 3600 });
  logger.debug({ redisUrl: config.redisUrl }, 'Redis persistence initialized');
}

const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  // Only handle our Yjs collaboration path
  if (!req.url?.startsWith('/yjs/')) {
    socket.destroy();
    return;
  }

  // Extract the document ID from the URL: /yjs/<docId>
  const docId = req.url.slice('/yjs/'.length);

  // Normalize Sec-WebSocket-Protocol header to a single token string
  const protocolHeader = req.headers['sec-websocket-protocol'];
  const token = Array.isArray(protocolHeader) ? protocolHeader[0] : protocolHeader;
  if (!token) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  let payload;
  try {
    // Verify JWT signature and audience/issuer as desired
    payload = jwt.verify(token, config.authPublicKey, {
      algorithms: ['RS256'],
      issuer: config.authIssuer,
    });
  } catch (err) {
    logger.warn({ err: err.message }, 'JWT verification failed');
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  // Ensure the token is for this document
  if (payload.doc !== docId) {
    logger.warn({ payloadDoc: payload.doc, requestedDoc: docId }, 'Doc ID mismatch');
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return;
  }

  // Enforce that the user has the "editor" role
  const roles = Array.isArray(payload.roles) ? payload.roles : [];
  if (!roles.includes('editor')) {
    logger.warn({ roles }, 'ACL denied: missing "editor" role');
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }

  // Attach the authenticated userId for Yjs context
  req.headers['x-user-id'] = payload.sub;
  logger.debug({ userId: payload.sub, docId }, 'WebSocket authenticated');

  // Delegate to y-websocket
  wss.handleUpgrade(req, socket, head, ws => {
    setupWSConnection(ws, req, {
      docName: docId,
      persistence,
      userId: payload.sub,
    });
  });
});

server.listen(config.port, () => {
  logger.info({ port: config.port }, 'Yjs WebSocket server listening');
});
