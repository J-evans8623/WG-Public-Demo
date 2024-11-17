/**
 * @file personalizedEdits.ts
 * @description
 * Defines REST API routes for managing personalized edit operations.
 * Includes endpoints for creating, retrieving, updating, and deleting personalized edits.
 * Secures routes with authentication middleware.
 */

import express from 'express';
import { authenticate } from '../middleware/authenticate';
import {
    createPersonalizedEdit,
    getPersonalizedEdits,
    updatePersonalizedEdit,
    deletePersonalizedEdit,
} from '../controllers/personalizedEditController';

export const personalizedEditsRouter = express.Router();

// All routes in this router require authentication
personalizedEditsRouter.use(authenticate);

// Create a new personalized edit
personalizedEditsRouter.post('/', createPersonalizedEdit);

// Retrieve all personalized edits for the authenticated user
personalizedEditsRouter.get('/', getPersonalizedEdits);

// Update an existing personalized edit
personalizedEditsRouter.patch('/:editId', updatePersonalizedEdit);

// Delete a personalized edit
personalizedEditsRouter.delete('/:editId', deletePersonalizedEdit);

// Export the router for use in the main application
export default personalizedEditsRouter;
