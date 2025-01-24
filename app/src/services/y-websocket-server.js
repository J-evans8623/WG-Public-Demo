//// y-websocket-server.js

/**
 * @file y-websocket-server.js
 * @description
 * This file sets up and manages the WebSocket server for real-time collaboration.
 * It handles client connections, message broadcasting, Redis integration for cross-instance synchronization,
 * logging, and graceful shutdowns. The server ensures secure token-based authentication and maintains
 * detailed logs for monitoring and debugging purposes.
 */

// Import necessary modules and configurations
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const http = require('http');
const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;
const { setupWSConnection } = require('y-websocket/bin/utils');
const { validateWebSocketToken } = require('../utils/webSocketToken.js');
const winston = require('winston');
const Redis = require('ioredis');

/**
 * @section Logging System
 * Configures the Winston logger to handle logging with timestamps, different log levels,
 * and outputs to both console and file. It also replaces the default console methods
 * with enhanced logging capabilities.
 */
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      if (typeof message === 'object') {
        return `${timestamp} [${level.toUpperCase()}]: ${JSON.stringify(message)}`;
      }
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'server.log', level: 'info' })
  ]
});

// Replace console methods with enhanced logging
console.log = (...args) => {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : arg
  ).join(' ');
  logger.info(message);
};

console.error = (...args) => {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : arg
  ).join(' ');
  logger.error(message);
};

/**
 * @section Redis Integration
 * Sets up Redis publishers and subscribers for message persistence and cross-instance synchronization.
 * Utilizes Redis Pub/Sub functionality to handle real-time message distribution across different server instances.
 */
const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
  username: 'default',
  password: process.env.REDIS_PASSWORD || undefined,
};

const redisPublisher = new Redis(redisConfig);
const redisSubscriber = new Redis(redisConfig);

/**
 * @section Server Setup
 * Creates the HTTP server and initializes the WebSocket server. Configures the server to listen on a specified port.
 */
const server = http.createServer();
const wss = new WebSocketServer({ server });

// Track connected clients using a Map for efficient client management
const connectedClients = new Map();

/**
 * @function Connection Handler
 * @description
 * Handles new WebSocket connections by validating tokens, tracking clients, managing sessions,
 * and setting up message handlers for each client. Ensures secure connections and manages
 * the lifecycle of each WebSocket connection.
 */
wss.on('connection', (ws, req) => {
  logger.info('[WebSocket] New connection established');
  
  // Parse the token from the connection URL
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  
  if (!token) {
    logger.warn('[WebSocket] Connection rejected: No token provided');
    ws.close(1008, 'Authentication token missing');
    return;
  }

  try {
    // Validate the token and extract payload
    const cleanToken = token.split('/')[0];
    const payload = validateWebSocketToken(cleanToken);
    const { sessionId, documentId } = payload;

    logger.info('[WebSocket] Token validated', { sessionId, documentId });

    // Track connection info
    const connectionInfo = {
      sessionId,
      documentId,
      timestamp: Date.now()
    };

    ws.connectionInfo = connectionInfo;
    connectedClients.set(ws, connectionInfo);

    /**
     * @event message
     * @description
     * Handles incoming binary messages from clients, logs the details,
     * broadcasts the message to other relevant clients, and persists the message using Redis.
     */
    ws.on('message', (message) => {
      logger.info('[WebSocket] Message received', {
        documentId: ws.connectionInfo?.documentId,
        messageType: message instanceof Buffer ? 'Buffer' : typeof message,
        messageSize: message.length,
        timestamp: new Date().toISOString()
      });

      try {
        // Ensure message is a Buffer
        const messageBuffer = Buffer.isBuffer(message) ? message : Buffer.from(message);

        // Broadcast to connected clients
        const connectedClientsCount = Array.from(wss.clients).filter(
          client => client.connectionInfo?.documentId === documentId
        ).length;

        logger.info('[WebSocket] Broadcasting update', {
          documentId,
          connectedClients: connectedClientsCount,
          updateSize: messageBuffer.length
        });

        wss.clients.forEach((client) => {
          if (client !== ws && 
              client.readyState === WebSocket.OPEN && 
              client.connectionInfo?.documentId === documentId) {
            
            logger.info('[WebSocket] Sending to client', {
              targetSessionId: client.connectionInfo?.sessionId,
              updateSize: messageBuffer.length
            });
            
            client.send(messageBuffer);
          }
        });

        // Store in Redis for persistence and cross-instance sync
        const channel = `doc-${documentId}`;
        redisPublisher.publish(channel, messageBuffer.toString('base64'));


      } catch (error) {
        logger.error('[WebSocket] Error broadcasting message', {
          error: error.message,
          stack: error.stack
        });
      }
    });

    /**
     * @event close
     * @description
     * Handles client disconnections by removing them from the connected clients map
     * and logging the disconnection event.
     */
    ws.on('close', () => {
      logger.info('[WebSocket] Client disconnected', { sessionId, documentId });
      connectedClients.delete(ws);
    });

    /**
     * @event error
     * @description
     * Handles errors encountered by the client by logging detailed error information.
     */
    ws.on('error', (error) => {
      logger.error('[WebSocket] Client error', {
        sessionId,
        error: error.message,
        stack: error.stack
      });
    });

    logger.info('[WebSocket] Client connected', { sessionId, documentId });

  } catch (error) {
    logger.error('[WebSocket] Connection rejected', {
      error: error.message,
      stack: error.stack
    });
    ws.close(1008, 'Invalid or expired token');
  }
});

/**
 * @function Redis Message Handler
 * @description
 * Listens for messages published on Redis channels and broadcasts them to the appropriate clients.
 * Ensures that binary data is correctly handled and sent to targeted clients based on document ID.
 */
redisSubscriber.on('message', (channel, message) => {
  const documentId = channel.replace('doc-', '');
  const messageBuffer = Buffer.from(message, 'base64');
  
  logger.info('[Redis] Message received', {
    documentId,
    messageSize: messageBuffer.length
  });
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && 
        client.connectionInfo?.documentId === documentId) {
      client.send(messageBuffer);
    }
  });
});

/**
 * @section Redis Subscription
 * Subscribes to Redis channels that follow the pattern 'doc-*' to listen for document updates.
 * Logs the subscription status and handles any subscription errors.
 */
redisSubscriber.psubscribe('doc-*', (err, count) => {
  if (err) {
    logger.error('[Redis] Subscription error', { error: err.message });
  } else {
    logger.info('[Redis] Subscribed to channels', { count });
  }
});

/**
 * @section Error Handlers
 * Sets up global error handlers for the WebSocket and HTTP servers to log detailed error information.
 */
wss.on('error', (error) => {
  logger.error('[WebSocket] Server error', {
    error: error.message,
    stack: error.stack
  });
});

server.on('error', (error) => {
  logger.error('[HTTP] Server error', {
    error: error.message,
    stack: error.stack
  });
});

/**
 * @section Start Server
 * Initiates the HTTP server to listen on the specified port and logs the server start event.
 */
const PORT = process.env.Y_WEBSOCKET_PORT ? parseInt(process.env.Y_WEBSOCKET_PORT) : 1234;
server.listen(PORT, () => {
  logger.info('[Server] Started', { port: PORT });
});

/**
 * @section Graceful Shutdown
 * Handles the SIGTERM signal to gracefully shut down the WebSocket and HTTP servers,
 * ensuring all resources are cleaned up and connections are properly terminated.
 */
process.on('SIGTERM', () => {
  logger.info('[Server] Shutting down');
  wss.close(() => {
    logger.info('[WebSocket] Server closed');
    server.close(() => {
      logger.info('[HTTP] Server closed');
      process.exit(0);
    });
  });
});
