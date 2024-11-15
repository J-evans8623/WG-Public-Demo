/**
 * @file server.ts
 * @description This file sets up the server infrastructure for the collaborative service.
 * It initializes and configures the Express application, integrates Socket.IO for real-time communication,
 * and exports the server, app, and Socket.IO instance for further use.
 *
 * @usage
 * - Import and use `server` to start the application on a specified port.
 * - Use `app` to define and configure routes and middleware.
 * - Use `io` to handle real-time events via WebSocket connections.
 *
 * @dependencies
 * - express: A minimal web framework for defining HTTP routes and middleware.
 * - http: Node.js HTTP module for creating the server.
 * - socket.io: A library for enabling real-time, bidirectional communication between clients and the server.
 */

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);

app.use(express.json());

// Example route
app.get('/', (req, res) => {
  res.send('Server is running!');
});

export { app, server, io };
