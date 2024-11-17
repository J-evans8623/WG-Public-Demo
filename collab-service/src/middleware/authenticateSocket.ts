/**
 * @file authenticateSocket.ts
 * @description 
 * Middleware for authenticating Socket.IO connections using JWT.
 * Validates the token provided during the Socket.IO handshake.
 * Attaches decoded user information to the socket object upon successful verification.
 */

import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Extends the Socket interface to include user information.
 */
interface AuthenticatedSocket extends Socket {
    user?: any;
}

/**
 * Middleware function to authenticate Socket.IO connections.
 * Extracts and verifies JWT from the handshake authentication payload.
 * Attaches decoded user information to the socket object.
 *
 * @param socket - The incoming Socket.IO connection.
 * @param next - Callback to proceed to the next middleware or connection handler.
 */
export function authenticateSocket(socket: AuthenticatedSocket, next: (err?: Error | undefined) => void): void {
    const token = socket.handshake.auth?.token;

    if (!token) {
        return next(new Error('Authentication token is missing.'));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
        socket.user = decoded; // Attach decoded user to the socket
        next(); // Proceed with the connection
    } catch (error) {
        next(new Error('Invalid authentication token.'));
    }
}
