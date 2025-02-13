/**
 * /pages/api/aiServiceLayer.ts
 *
 * Centralized API handler for AI pipeline requests.
 *
 * Responsibilities:
 * - Authenticate incoming requests using the OAuth 2.0 PKCE security layer.
 * - Route requests based on the action parameter.
 * - For lesson generation ("newLesson"), it accepts a documentID and moduleID,
 *   retrieves the precomputed lesson module, and calls the AIController.generateLesson method.
 * - For quiz generation ("newQuiz"), it similarly accepts a documentID and moduleID
 *   and routes the request to the appropriate quiz generation method.
 * - Also handles "getLessonList", "getLessonModule", and "question" actions.
 *
 * Note:
 * - The lesson module is internal backend data and is not sent directly to the client.
 * - The processDocument action has been removed.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { getLessonList } from '../../app/src/services/TextPreprocessing/LessonModuleService';
import { getQuestionContext } from '../../app/src/services/TextPreprocessing/QuestionContextService';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest'; // Adjust path as needed
import AIController from '@/app/src/controllers/aiController'; // Adjust path as needed

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Step 1: Authenticate the incoming request.
  const sessionData = await authenticateRequest(req, res);
  if (!sessionData) return; // Authentication failure is handled by authenticateRequest

  try {
    const { action } = req.query;

    // Case: Retrieve lesson module list filtered by documentID.
    if (action === 'getLessonList') {
      
      const documentID = req.query.documentID as string;
      console.log('aiServiceLayer.ts invoking getLessonList ..... with ID', documentID)
      const list = await getLessonList(documentID);
      res.status(200).json(list);

    // Case: Handle the Q/A pipeline.
    } else if (action === 'question') {
      const { textSelection, question } = req.body;
      const context = await getQuestionContext(textSelection);
      res.status(200).json({ context, question });

    // New Case: Generate a lesson using precomputed lesson module data.
    } else if (action === 'newLesson') {
      // Step 2: Validate input.
      const { documentID, moduleID } = req.body;
      if (!documentID || !moduleID) {
        res.status(400).json({ error: 'Missing documentID or moduleID for lesson generation.' });
        return;
      }
      // Step 3: Delegate lesson generation to AIController.
      // Note: The AIController.generateLesson method is expected to use the provided documentID and moduleID
      // to retrieve precomputed lesson module data and generate the final lesson.
      await AIController.generateLesson(req, res);

    // New Case: Generate a quiz from the lesson module.
    } else if (action === 'newQuiz') {
      // Step 2: Validate input.
      const { documentID, moduleID } = req.body;
      if (!documentID || !moduleID) {
        res.status(400).json({ error: 'Missing documentID or moduleID for quiz generation.' });
        return;
      }
      // Step 3: Delegate quiz generation to AIController.
      // For this example, we use the multiple choice quiz generation as a placeholder.
      await AIController.generateQuiz_multipleChoice(req, res);

    } else {
      res.status(400).json({ error: 'Invalid action parameter' });
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Server error' });
  }
}
