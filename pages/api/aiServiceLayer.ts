/**
 * /pages/api/aiServiceLayer.ts
 *
 * Centralized API handler for AI pipeline requests.
 *
 * Responsibilities:
 * - Authenticate incoming requests using the OAuth 2.0 PKCE security layer.
 * - Route requests based on the "action" query parameter.
 *   - getLessonList: returns a lesson list for a given documentID
 *   - question: handle user Q&A
 *   - newLesson: generate AI-driven lesson
 *   - newQuiz: (legacy) single-type quiz generation
 *   - generateTopic: generate a new topic for the concept map
 *   - quizGenerator: (new) handle specialized multi-topic, multi-type quiz generation from the Quiz Tool
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { getLessonList } from '../../app/src/services/TextPreprocessing/LessonModuleService';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import AIController from '@/app/src/controllers/aiController';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[aiServiceLayer] Received request with action:', req.query.action);

  // OAuth 2.0 PKCE authentication
  const sessionData = await authenticateRequest(req, res);
  if (!sessionData) return;

  try {
    const { action } = req.query;

    // 1) Retrieve lesson list
    if (action === 'getLessonList') {
      const documentID = req.query.documentID as string;
      console.log('[aiServiceLayer] getLessonList called with documentID:', documentID);
      const list = await getLessonList(documentID);
      console.log('[aiServiceLayer] getLessonList result:', list);
      res.status(200).json(list);
      return;
    }

    // 2) Q&A pipeline
    if (action === 'question') {
      console.log('[aiServiceLayer] Routing to handleQuestion');
      await AIController.handleQuestion(req, res);
      return;
    }

    // 3) Generate a new lesson
    if (action === 'newLesson') {
      const { documentID, moduleID } = req.body;
      console.log('[aiServiceLayer] newLesson called with documentID:', documentID, 'moduleID:', moduleID);
      if (!documentID || !moduleID) {
        res.status(400).json({ error: 'Missing documentID or moduleID for lesson generation.' });
        return;
      }
      await AIController.generateLesson(req, res);
      return;
    }

    // 4) Generate a new topic
    if (action === 'generateTopic') {
      console.log('[aiServiceLayer] Routing to handleTopicGeneration');
      await AIController.handleTopicGeneration(req, res);
      return;
    }

    // 5) New action: specialized multi-topic, multi-type quiz generation
    if (action === 'quizGenerator') {
      console.log('[aiServiceLayer] Routing to handleQuizTool (new approach)');
      /**
       * The request body is expected to include:
       *  - topicIds: string[]
       *  - quizTypes: string[]
       *  - includeDocs: boolean
       *  - fileID: string
       *  - summary: string
       *  - summaryPresent: boolean
       *  - mapID: string
       */
      await AIController.handleQuizTool(req, res);
      return;
    }

    // If no matching action, return error
    res.status(400).json({ error: 'Invalid action parameter' });
  } catch (error) {
    console.error('[aiServiceLayer] Error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Server error' });
  }
}
