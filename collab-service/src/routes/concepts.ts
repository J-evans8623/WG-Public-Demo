// collab-service/src/routes/concepts.ts

/**
 * @file concepts.ts
 * @description 
 * Defines REST API routes for managing concept-related operations.
 */

import express from 'express';
import { authenticate } from '../middleware/authenticate';
import { isAdmin } from '../middleware/isAdmin';
import { getAllConcepts, createConcept, updateConcept, deleteConcept } from '../controllers/conceptController';

export const conceptsRouter = express.Router();

// Retrieve all concepts (public route)
conceptsRouter.get('/', getAllConcepts);

// Create a new concept (authenticated)
conceptsRouter.post('/', authenticate, createConcept);

// Update an existing concept (authenticated)
conceptsRouter.patch('/:conceptId', authenticate, updateConcept);

// Delete a concept (authenticated, admin-only for global deletions)
conceptsRouter.delete('/:conceptId', authenticate, isAdmin, deleteConcept);

// Export the router explicitly for testability
export default conceptsRouter;
