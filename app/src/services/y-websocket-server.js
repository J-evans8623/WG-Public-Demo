const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const http = require('http');
const { WebSocketServer } = require('ws');
const { setupWSConnection } = require('y-websocket/bin/utils');
const { validateWebSocketToken } = require('../utils/webSocketToken.js');
const winston = require('winston');
const Redis = require('ioredis');
const redisClient = require('../utils/redisClient');

// Create a logger instance
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'server.log', level: 'info' }),
  ],
});

// Replace console.log with logger.info
console.log = (...args) => {
  logger.info(args.join(' '));
};

// Replace console.error with logger.error
console.error = (...args) => {
  logger.error(args.join(' '));
};

// Create Redis clients for Pub/Sub
const redisPublisher = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
  username: 'default',
  password: process.env.REDIS_PASSWORD || undefined,
});

const redisSubscriber = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
  username: 'default',
  password: process.env.REDIS_PASSWORD || undefined,
});

// Create an HTTP server
const server = http.createServer();

// Create a WebSocket server
const wss = new WebSocketServer({ server });

// Handle new WebSocket connections
wss.on('connection', (ws, req) => {
  // Extract the token from query parameters
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    console.warn('Connection rejected: No token provided.');
    ws.close(1008, 'Authentication token missing');
    return;
  }

  try {
    // Validate the token
    const cleanToken = token.split('/')[0];
    const payload = validateWebSocketToken(cleanToken);

    const { sessionId, documentId } = payload;

    console.log(`Validating sessionId=${sessionId} for documentId=${documentId}`);

    // Integrate Redis Pub/Sub with y-websocket's setupWSConnection
    setupWSConnection(ws, req, {
      docName: documentId,
      gc: true,
      persistence: null,
    });

    // Store documentId on the WebSocket connection
    ws.documentId = documentId;

    console.log(`Session ${sessionId} connected to document ${documentId}.`);
  } catch (error) {
    console.error(`Connection rejected: ${error.message}`);
    ws.close(1008, 'Invalid or expired token');
  }
});

// Subscribe to Redis channels for document synchronization
redisSubscriber.on('message', (channel, message) => {
  const documentId = channel.replace('doc-', '');
  const update = Buffer.from(message, 'base64');
  // Broadcast the update to all connected clients of the document
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client.documentId === documentId) {
      client.send(update);
    }
  });
});

// Listen to all document channels
redisSubscriber.psubscribe('doc-*', (err, count) => {
  if (err) {
    console.error('Failed to subscribe to Redis channels:', err);
  } else {
    console.log(`Subscribed to ${count} Redis channels for document synchronization.`);
  }
});

// Start the server
const PORT = process.env.Y_WEBSOCKET_PORT ? parseInt(process.env.Y_WEBSOCKET_PORT) : 1234;
server.listen(PORT, () => {
  console.log(`y-websocket server is running on port ${PORT}`);
});