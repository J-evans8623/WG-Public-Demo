/**
 * routes/aiRoutes.ts
 * 
 * Defines API routes for AI-related operations.
 * 
 * Responsibilities:
 * - Sets up Express routes for AI services.
 * - Associates routes with corresponding controller methods and middleware.
 * - Handles both text and PDF inputs for lesson and quiz generation.
 */

import express from 'express';
import multer from 'multer';
import AIController from '../controllers/aiController';

const router = express.Router();

// Set up multer for handling PDF uploads
const upload = multer({ dest: 'uploads/' });

/**
 * Route for generating structured lessons.
 * - Handles both text input and PDF uploads.
 */
router.post('/generate-lesson', upload.single('pdf'), AIController.generateLesson);

/**
 * Route for generating structured quizzes.
 * - Handles both text input and PDF uploads.
 */
router.post('/generate-quiz', upload.single('pdf'), AIController.generateQuiz);

export default router;
