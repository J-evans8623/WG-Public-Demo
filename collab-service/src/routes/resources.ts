/**
 * @file resources.ts
 * @description 
 * Defines REST API routes for managing resource-related operations.
 * Includes endpoints for retrieving all resources, retrieving a specific resource,
 * creating, updating, and deleting resources.
 * Secures routes with authentication and role-based access control where necessary.
 * Adheres to SOLID principles by maintaining single responsibility and modularity.
 */

import express from 'express';
import { authenticate } from '../middleware/authenticate';
import { isAdmin } from '../middleware/isAdmin';
import { getAllResources, getResource, createResource, updateResource, deleteResource } from '../controllers/resourceController';

export const resourcesRouter = express.Router();

// Retrieve all resources (public route)
resourcesRouter.get('/', getAllResources);

// Retrieve a specific resource by ID (public route)
resourcesRouter.get('/:resourceId', getResource);

// Create a new resource (authenticated)
resourcesRouter.post('/', authenticate, createResource);

// Update an existing resource (authenticated)
resourcesRouter.patch('/:resourceId', authenticate, updateResource);

// Delete a resource (authenticated, admin-only)
resourcesRouter.delete('/:resourceId', authenticate, isAdmin, deleteResource);

// Export the router explicitly for testability
export default resourcesRouter;
