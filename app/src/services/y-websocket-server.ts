// y-websocket-server.ts

/**
 * @file y-websocket-server.ts
 * @description
 * Initializes a y-websocket server for real-time Yjs document synchronization with token-based authentication.
 *
 * Dependencies:
 * - y-websocket
 * - yjs
 * - ws
 * - dotenv
 * - utils/webSocketToken.ts
 * - utils/SessionDocumentMapper.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });


import http from 'http';
import WebSocket, { WebSocketServer } from 'ws'; // Correctly import WebSocket from 'ws'
import * as Y from 'yjs';
import { addSessionToDocument, removeSessionFromDocument, getDocumentBySession } from '../utils/SessionDocumentMapper';
import { validateWebSocketToken } from '../utils/webSocketToken';
import { redisClient } from '../utils/redisClient'; // Adjust the path as necessary
import { createLogger, format, transports } from 'winston';
import { updateSessionTTL } from '../utils/SessionDocumentMapper';

// Create a logger instance
const logger = createLogger({
  level: 'info', // Default logging level
  format: format.combine(
    format.timestamp(),
    format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
  ),
  transports: [
    new transports.Console(), // Log to the console
    new transports.File({ filename: 'server.log', level: 'info' }), // Log to a file
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


// Define interfaces for type safety
interface WebSocketSession {
  sessionId: string;
  documentId: string;
}

// In-memory map to store Y.Doc instances per document
const docs: Map<string, Y.Doc> = new Map();

// Create an HTTP server
const server = http.createServer();

// Create a WebSocket server
const wss = new WebSocketServer({ server });

// Function to get or create a Y.Doc for a document
const getYDoc = (documentId: string): Y.Doc => {
  let doc = docs.get(documentId);
  if (!doc) {
    doc = new Y.Doc();
    docs.set(documentId, doc);
    console.log(`Created new Y.Doc for documentId=${documentId}`);
  }
  return doc;
};

// Handle new WebSocket connections
wss.on('connection', async (ws: WebSocket, req: http.IncomingMessage) => {
  // Extract the token from query parameters
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    console.warn('Connection rejected: No token provided.');
    ws.close(1008, 'Authentication token missing'); // Policy Violation
    return;
  }

  try {
    // Validate the token
    const cleanToken = token.split('/')[0];
    const payload = validateWebSocketToken(cleanToken);

    const { sessionId, documentId } = payload;

    console.log(`Validating sessionId=${sessionId} for documentId=${documentId}`);

    // Verify session-document mapping in Redis
    const associatedDocumentId = await getDocumentBySession(sessionId);
    if (associatedDocumentId !== documentId) {
      console.warn(`Session ${sessionId} is not associated with document ${documentId}.`);
      ws.close(1008, 'Invalid session-document mapping'); // Policy Violation
      return;
    }

    console.log(`Session ${sessionId} is associated with document ${documentId}.`);

    // Associate session with document in Redis
    await addSessionToDocument(documentId, sessionId);

    // Get or create the Y.Doc
    const ydoc = getYDoc(documentId);

    // Send the current state of the document to the newly connected client
    const state = Y.encodeStateAsUpdate(ydoc);
    ws.send(state);
    console.log(`Sent initial state to session ${sessionId} for document ${documentId}.`);

    // Handle incoming messages (Yjs updates) from clients
    ws.on('message', (data: Buffer) => {
      updateSessionTTL(sessionId).catch(error => {
        console.error(`Failed to update TTL for session ${sessionId}:`, error);
      });
      const update = new Uint8Array(data);
      try {
        Y.applyUpdate(ydoc, update);
        console.log(`Applied update from session ${sessionId} to document ${documentId}.`);
        // Broadcast the update to all other clients connected to the same document
        wss.clients.forEach(client => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(update);
          }
        });
      } catch (error) {
        console.error(`Error applying update from session ${sessionId}:`, error);
        ws.close(1011, 'Error processing update'); // Internal Error
      }
    });

    // Handle disconnection
    ws.on('close', async () => {
      console.log(`Session ${sessionId} disconnected from document ${documentId}.`);
      await removeSessionFromDocument(documentId, sessionId);
    });

    // Handle errors
    ws.on('error', (error: Error) => { // Specify error type as Error
      console.error(`WebSocket error for session ${sessionId}:`, error);
    });
  } catch (error: any) { // Handle any type of error
    console.error(`Connection rejected: ${error.message}`);
    ws.close(1008, 'Invalid or expired token'); // Policy Violation
  }
});

// Start the server
const PORT = process.env.Y_WEBSOCKET_PORT ? parseInt(process.env.Y_WEBSOCKET_PORT) : 1234;
server.listen(PORT, () => {
  console.log(`y-websocket server is running on port ${PORT}`);
});
