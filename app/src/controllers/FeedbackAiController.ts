/**
 * @file FeedbackAiController.ts
 * @description
 * This controller serves as the authoritative orchestrator for the Quiz Feedback Pipeline. 
 * Its primary responsibility is to manage the request-response lifecycle for feedback-enriched 
 * assessments, acting as the bridge between the API layer and the AiFeedbackService. 
 * It handles the critical 'Post-Process' phase where simplified LLM tokens (A0, A1) are 
 * mapped back to actual system UUIDs using the TopicIdMapper instance. This ensures 
 * that the resulting quiz data is structurally valid for database insertion and 
 * student remediation links. By existing as a separate controller, it provides the 
 * one-click 'Pipeline Toggle' required for system safety; routing traffic here enables 
 * advanced feedback, while routing to the legacy AIController reverts the system to 
 * standard generation, satisfying the sprint's core safety and SOLID design objectives.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { AiFeedbackService } from '@/app/src/services/feedback/aiFeedbackService';

class FeedbackAiController {
  private static feedbackService: AiFeedbackService = new AiFeedbackService();

  /**
   * handleFeedbackQuiz
   * @description
   * The entry point for the feedback pipeline. It extracts request metadata, coordinates 
   * the feedback-enriched AI call, and translates simplified tokens back to real IDs.
   * @param req - The NextApiRequest containing exportData and mapping context.
   * @param res - The NextApiResponse for returning the finalized enriched quiz.
   */
  public static async handleFeedbackQuiz(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
      // 1. Extract the context and mapper from the Phase 1 aiServiceLayer update
      const { exportData, questionCount, promptExtension, topicMapperInstance } = req.body;

      // 2. Call the specialized feedback service
      console.log('[FeedbackAiController.ts][5401] Initiating feedback-enriched generation');
      const rawQuiz = await this.feedbackService.generateFeedbackQuiz(
        exportData,
        promptExtension,
        questionCount
      );

      // 3. Post-Process: Remap tokens (A0, B1) back to real system UUIDs
      // Time Complexity: O(N) where N is the number of questions.
      if (rawQuiz && rawQuiz.questions && topicMapperInstance) {
        rawQuiz.questions = rawQuiz.questions.map((q: any) => {
          const realTopicId = topicMapperInstance.getRealId(q.topicKey);
          
          return {
            ...q,
            // 4. Map the temporary key to the permanent ID used for remediation navigation
            topicId: realTopicId || "unknown",
            attributionValid: !!realTopicId
          };
        });
      }

      console.log('[FeedbackAiController.ts][5402] Enriched quiz generation successful');
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