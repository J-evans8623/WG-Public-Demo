// utils/webSocketToken.ts

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Configuration for token generation.
 * - `JWT_SECRET`: Secret key for JWT signing.
 */
const JWT_SECRET = process.env.JWT_SECRET || "TemporaryTestSecret123"; // Hardcoded for debugging

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not defined.');
}

/**
 * Interface for the payload contained within the WebSocket token.
 */
interface WebSocketTokenPayload {
  sessionId: string;
  documentId: string;
}

/**
 * Generates a secure WebSocket token using JWT.
 * @param sessionId - The session ID of the user.
 * @param documentId - The document ID being edited.
 * @returns A signed JWT containing the sessionId and documentId.
 */
export const generateWebSocketToken = (sessionId: string, documentId: string): string => {
  console.log('***************');
  console.log('Debugging generateWebSocketToken');
  console.log('sessionId:', sessionId);
  console.log('documentId:', documentId);

  const payload: WebSocketTokenPayload = {
    sessionId,
    documentId,
  };

  // Token options: set expiration to 5 minutes
  const options = {
    expiresIn: '5m', // 5 minutes
  };

  const token = jwt.sign(payload, JWT_SECRET, options);
  console.log('Generated token:', token);
  console.log('***************');

  return token;
};

/**
 * Validates a WebSocket token using JWT.
 * @param token - The JWT to validate.
 * @returns The decoded payload if valid; otherwise, throws an error.
 * @throws Error if the token is invalid or tampered with.
 */
export const validateWebSocketToken = (token: string): WebSocketTokenPayload => {
  console.log('***************');
  console.log('Debugging validateWebSocketToken');
  
  // Remove any path separators that might be appended to the token
  const cleanToken = token.split('/')[0];
  console.log('Cleaned token:', cleanToken);

  try {
    const decoded = jwt.verify(cleanToken, JWT_SECRET) as WebSocketTokenPayload;
    console.log('Decoded payload:', decoded);
    return decoded;
  } catch (error: any) {
    console.error('Error during token validation:', error.message);
    console.log('***************');
    throw new Error('Token validation failed');
  }
};
