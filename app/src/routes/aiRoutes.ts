/**
 * routes/aiRoutes.ts
 * 
 * Defines API routes for AI-related operations.
 * 
 * Responsibilities:
 * - Sets up Express routes for AI services.
 * - Associates routes with corresponding controller methods and middleware.
 */

// routes/aiRoutes.ts
import express from 'express';
import AIController from '../controllers/aiController';

const router = express.Router();

router.post('/generate-ai', AIController.generateAI);

export default router;