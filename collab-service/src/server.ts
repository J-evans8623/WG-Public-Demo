/**
 * @file server.ts
 * @description 
 * Initializes the Express application and Socket.IO server.
 * Sets up middleware, routes, and real-time communication handlers.
 * Responsible for starting the backend service and managing real-time collaboration.
 */

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import { authenticateSocket } from './middleware/authenticateSocket';
import { conceptsRouter } from './routes/concepts';
import { resourcesRouter } from './routes/resources';
import { usersRouter } from './routes/users';
import { initializeDBConnection } from './utils/db';
import { rateLimiter } from './middleware/rateLimiter';
import { handleSocketEvents } from './socketHandlers';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Apply rate limiting middleware globally
app.use(rateLimiter);

// Initialize the database connection
initializeDBConnection();

// Setup API Routes with correct prefixes
app.use('/api/concepts', conceptsRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/users', usersRouter);

// Health check route
app.get('/', (req, res) => {
    res.send('Collaborative Study Service is running...');
});

// Create HTTP server
const httpServer = http.createServer(app);

// Initialize Socket.IO server
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

// Apply socket authentication middleware
io.use(authenticateSocket);

// Handle socket connections
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    handleSocketEvents(io, socket);
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// Start the server in non-test environments
if (process.env.NODE_ENV !== 'test') {
    const PORT = process.env.PORT || 3001;
    httpServer.listen(PORT, () => {
        console.log(`Collaborative Study Service is listening on port ${PORT}`);
    });
}

// Export the app and httpServer for testing purposes
export { app, httpServer };
