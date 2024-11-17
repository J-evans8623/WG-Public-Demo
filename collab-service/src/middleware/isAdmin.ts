// collab-service/src/middleware/isAdmin.ts

/**
 * @file isAdmin.ts
 * @description 
 * Middleware to verify if the authenticated user has admin privileges.
 * Ensures that certain routes or actions are restricted to admin users only.
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Extends the Express Request interface to include user information.
 */
interface AuthenticatedRequest extends Request {
    user?: any;
}

export function isAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admins only.' });
    }
}
