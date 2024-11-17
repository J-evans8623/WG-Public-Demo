// collab-service/src/middleware/authenticate.ts

/**
 * @file authenticate.ts
 * @description 
 * Middleware for authenticating users using JWT (JSON Web Tokens).
 * Validates the presence and validity of the token in the Authorization header.
 * Attaches decoded user information to the request object upon successful verification.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Extends the Express Request interface to include user information.
 */
interface AuthenticatedRequest extends Request {
    user?: any;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    const authHeader = req.headers?.authorization; // Optional chaining to avoid TypeError

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ message: 'Authentication token is missing or malformed.' });
        return; // Explicitly terminate the middleware execution
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid authentication token.' });
    }
}
