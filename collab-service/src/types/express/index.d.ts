/**
 * @file index.d.ts
 * @description
 * Extends the Express Request interface to include a 'user' property.
 * This allows middleware and controllers to access authenticated user information.
 */

import { IUser } from '../../models/User'; // Adjust the path as necessary

declare global {
    namespace Express {
        interface Request {
            user?: IUser;
        }
    }
}
