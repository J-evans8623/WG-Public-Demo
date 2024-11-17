/**
 * @file users.ts
 * @description 
 * Defines REST API routes for managing user-related operations.
 * Includes endpoints for user registration, authentication, and profile retrieval.
 * Secures routes with authentication where necessary.
 * Adheres to SOLID principles by maintaining single responsibility and modularity.
 */

import express from 'express';
import { registerUser, loginUser, getUserProfile } from '../controllers/userController';
import { authenticate } from '../middleware/authenticate';

export const usersRouter = express.Router();

// Register a new user (public route)
usersRouter.post('/register', registerUser);

// Login a user and provide a JWT (public route)
usersRouter.post('/login', loginUser);

// Retrieve user profile (authenticated route)
usersRouter.get('/:userId', authenticate, getUserProfile);

// Export the router explicitly for testability
export default usersRouter;
