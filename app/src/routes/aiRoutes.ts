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
import multer from 'multer';

const router = express.Router();

// Set up multer for handling PDF uploads
const upload = multer({ dest: 'uploads/' });


router.post('/generate-ai', AIController.generateAI);
router.post('/generate-ai-pdf', upload.single('pdf'), AIController.generateAIWithPDF);

export default router;