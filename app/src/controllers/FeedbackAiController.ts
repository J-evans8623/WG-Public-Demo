/**
 * @file FeedbackAiController.ts
 * @description
 * (update - 1.1)
 * This controller has been refactored to resolve the argument mismatch error by explicitly 
 * handling dynamic quiz types within the Feedback Quiz Pipeline. Its primary responsibility 
 * is to act as the authoritative orchestrator between the API routing layer (aiServiceLayer) 
 * and the specialized AiFeedbackService. It extracts format preferences (e.g., matching, 
 * true-false) from the request body and propagates them to the AI engine to ensure the 
 * correct pedagogical JSON schema is resolved. Following the AI generation phase, the 
 * controller executes a critical post-processing step: it utilizes the TopicIdMapper 
 * instance to translate simplified LLM tokens back into authoritative system UUIDs. 
 * This ensures that citation-enriched questions are accurately attributed to the 
 * correct conceptual nodes, facilitating interactive remediation navigation for scholars. 
 * The implementation maintains the redundant pipeline architecture required for system 
 * safety and adheres to O(N) complexity for token reconciliation.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { AiFeedbackService } from '@/app/src/services/feedback/aiFeedbackService';
import { raw } from 'express';

class FeedbackAiController {
  private static feedbackService: AiFeedbackService = new AiFeedbackService();

  /**
   * handleFeedbackQuiz
   * @description
   * (update - 1.2) Refactored entry point that resolves the 'Expected 4 arguments' error. 
   * It captures the 'quizTypes' array from the request, normalizes the primary format, 
   * and forwards it to the feedback service to enable format-aware, citation-backed 
   * assessment generation.
   * @param req - The NextApiRequest containing lesson context, mapping data, and quiz format.
   * @param res - The NextApiResponse for returning the finalized enriched assessment.
   */
  public static async handleFeedbackQuiz(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      // 1. Step 1: Extract request metadata, including the previously missing quizTypes
      const { 
        exportData, 
        questionCount, 
        promptExtension, 
        topicMapperInstance,
        quizTypes // update - 1.3: Capture the format preference
      } = req.body;

      // 2. Step 2: Normalize the quiz type to ensure a valid 4th argument for the service
      // We prioritize the first type in the array, defaulting to multipleChoice if none provided.
      const requestedType = (Array.isArray(quizTypes) && quizTypes.length > 0) 
        ? String(quizTypes[0]) 
        : 'multipleChoice';

      // 3. Step 3: Call the service with the correct 4rd argument (quizType)
      // Logic satisfies the argument synchronization requirement
      console.log('[FeedbackAiController.ts][5401] Initiating format-aware feedback generation:', requestedType);
      const rawQuiz = await this.feedbackService.generateFeedbackQuiz(
        exportData,
        promptExtension,
        questionCount,
        requestedType // update - 1.4: Propagate the quiz type
      );

      // 4. Step 4: Post-Process: Remap tokens (A0, B1) back to real system UUIDs
      // Time Complexity: O(N) where N is the number of generated questions.
      // This ensures the frontend can locate study resources in ResourceContext
      if (rawQuiz && rawQuiz.questions && topicMapperInstance) {
        rawQuiz.questions = rawQuiz.questions.map((q: any) => {
          const realTopicId = topicMapperInstance.getRealId(q.topicKey);
          
          return {
            ...q,
            // 5. Step 5: Map the temporary key to the permanent ID used for remediation navigation
            topicId: realTopicId || "unknown",
            attributionValid: !!realTopicId
          };
        });
      }

      console.log(`[FeedbackAiController.ts][5402] Enriched assessment generation successful data payload 4356 : ${JSON.stringify(rawQuiz)} `);
      res.status(200).json(rawQuiz);

    } catch (error) {
      console.error('[FeedbackAiController.ts][5499] Feedback pipeline failed', error);
      res.status(500).json({
        error: 'FEEDBACK_PIPELINE_ERROR',
        message: 'Failed to generate enriched quiz feedback.',
        service: 'feedbackQuiz'
      });
    }
  }
}

export default FeedbackAiController;