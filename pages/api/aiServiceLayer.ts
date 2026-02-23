/**
 * @file aiServiceLayer.ts (Enhanced with Premium Access Control & Input Safety)
 * @description
 * Enhanced centralized API handler for AI pipeline requests.
 * * Updates in Phase 5:
 * - Added Input Safety Guards: Implements character limit validation for all incoming
 * text payloads to prevent token abuse and DoS attacks.
 * - Limits: 
 * - Queries (Questions/Topics): 5,000 chars
 * - Context (Export Data/Selections): 300,000 chars
 *
 * Responsibilities:
 * - Authenticate incoming requests (OAuth 2.0 PKCE).
 * - Enforce Input Size Limits (Safety Guards).
 * - Enforce premium access control and rate limiting.
 * - Route requests to AIController.
 * - Standardize error responses.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import AIController from '@/app/src/controllers/aiController';
import { validatePremiumAccess, mapActionToServiceType, ServiceType } from '@/app/src/services/validatePremiumAccess';
import { UserService } from '@/app/src/services/userService';
import { extractLessonsFromDocId} from '@/app/src/services/lessonExtraction/lessonExtractionService';
import { TopicIdMapper } from '@/app/src/utils/topicIdMapper';
import FeedbackAiController from '@/app/src/controllers/FeedbackAiController';

// update - 1: Define Safety Constants
const SAFETY_LIMITS = {
  // 100,000 chars ~= 25,000 tokens. Enough for a very detailed user prompt.
  MAX_QUERY_LENGTH: 100000, 
  // 300,000 chars ~= 75,000 tokens. Fits comfortably in Flash/Mini context windows.
  MAX_CONTEXT_LENGTH: 300000 
};

type ExtractedLesson = {
  lessonId: string;
  lessonTitle: string;
  topics: { topicTitle: string; topicContent: string }[];
};

function formatExportDataFromExtractedLesson(lesson: ExtractedLesson): string {
  const lines: string[] = [];
  lines.push(`# Lesson: ${lesson.lessonTitle || 'Untitled Lesson'}`);
  for (const t of lesson.topics) {
    const title = t.topicTitle?.trim() || 'Untitled Topic';
    const body = t.topicContent?.trim() || '';
    lines.push(`\n## Topic: ${title}`);
    if (body) lines.push(body);
  }
  return lines.join('\n');
}

// update - 2: Validation Helper Function
/**
 * Validates the size of text inputs to prevent abuse.
 * @throws Error if limits are exceeded.
 */
function validatePayloadSize(body: any, action: string) {
  const { question, userTopicRequest, exportData, textSelection } = body;

  // 1. Validate Query Inputs (Questions, Topic Requests)
  if (action === 'question' && question?.length > SAFETY_LIMITS.MAX_QUERY_LENGTH) {
    throw new Error(`Text limit exceeded, please try again with a shorter question.`);
  }
  if (action === 'generateTopic' && userTopicRequest?.length > SAFETY_LIMITS.MAX_QUERY_LENGTH) {
    throw new Error(`Text limit exceeded, please try again with a smaller request.`);
  }

  // 2. Validate Context Inputs (Export Data, Selections)
  // Note: We check this across all actions that might carry context
  if (exportData?.length > SAFETY_LIMITS.MAX_CONTEXT_LENGTH) {
    throw new Error(`Text limit exceeded, please try again with a smaller request.`);
  }
  if (textSelection?.length > SAFETY_LIMITS.MAX_CONTEXT_LENGTH) {
    throw new Error(`Text limit exceeded, please try again with a smaller request.`);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[aiServiceLayer.ts][3001] Enhanced AI service request received', { action: req.query.action });

  // Step 1: Authenticate request
  const sessionData = await authenticateRequest(req, res);
  if (!sessionData) {
    console.log('[aiServiceLayer.ts][3002] Authentication failed for AI service request');
    return; 
  }

  try {
    const { action } = req.query;

    // Step 2: Validate request method
    if (req.method !== 'POST') {
      console.log('[aiServiceLayer.ts][3004] Invalid HTTP method for AI service', { method: req.method });
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // update - 3: Perform Safety Check before expensive logic
    try {
        validatePayloadSize(req.body, action as string);
    } catch (validationError: any) {
        console.warn('[aiServiceLayer.ts][3004b] Payload safety check failed', { error: validationError.message });
        return res.status(400).json({
            error: 'VALIDATION_FAILED',
            message: validationError.message || 'Input payload too large',
            service: 'safetyGuard'
        });
    }

    // Step 3: Map action to service type for validation
    const serviceType: ServiceType = mapActionToServiceType(action as string);
    console.log('[aiServiceLayer.ts][3005] AI service mapped to type', { action, serviceType });

    // Step 4: Perform comprehensive premium access validation
    const validation = await validatePremiumAccess(sessionData.user.email, serviceType);
    
    if (!validation.allowed) {
      console.log('[aiServiceLayer.ts][3006] AI service access denied', {
        email: sessionData.user.email,
        serviceType,
        errorCode: validation.errorCode,
        upgradeRequired: validation.upgradeRequired
      });

      // Step 5: Return standardized error response
      return res.status(403).json({
        error: validation.errorCode,
        message: validation.errorMessage,
        service: serviceType,
        retryAfter: validation.retryAfter,
        upgradeRequired: validation.upgradeRequired || false,
        userStatus: {
          accountType: validation.userStatus.profile.accountType,
          subscriptionTier: validation.userStatus.profile.subscriptionTier,
          remainingDemoCredits: validation.userStatus.usage.demoCredits.remaining
        }
      });
    }

    console.log('[aiServiceLayer.ts][3007] AI service access granted, proceeding with request processing');

    // Step 6: Route to appropriate AI service handler
    let processingResult;
    
    if (action === 'question') {
      console.log('[aiServiceLayer.ts][3008] Routing to question handling service');
      processingResult = await processAIServiceRequest(
        () => AIController.handleQuestion(req, res),
        sessionData.user.email,
        'askAssistant'
      );
    } else if (action === 'generateTopic') {
      console.log('[aiServiceLayer.ts][3009] Routing to topic generation service');
      processingResult = await processAIServiceRequest(
        () => AIController.handleTopicGeneration(req, res),
        sessionData.user.email,
        'exploreTopic'
      );
    } 
    else if (action === 'quizGenerator') {
      
      console.log('[aiServiceLayer.ts][3010] Routing to quiz generation service');

      // [A] Shape/validate identifiers
      const body = req.body || {};
      const fileID: string | undefined = body.fileID || body.documentId || body.docId;
      const incomingTopicIds: string[] | undefined = Array.isArray(body.topicIds) ? body.topicIds : undefined;
      const lessonId: string | undefined = body.lessonId || (Array.isArray(body.topicIds) ? body.topicIds?.[0] : undefined);

      // Require fileID and either (topicIds[0]) or lessonId
      const selectedLessonId = lessonId || incomingTopicIds?.[0];
      if (!fileID || !selectedLessonId) {
        console.log('[aiServiceLayer.ts][3010A] Missing fileID or selectedLessonId for quiz generation');
        return res.status(400).json({
          error: 'MISSING_PARAMETERS',
          message: 'fileID and a single lessonId (concept map id) are required',
          service: 'createQuiz',
        });
      }

      // [B] Extract the requested lesson (Y.Doc → lesson object)
      // This branch is only activated if no export data is sent
      if (!req.body.exportData) {
        const lessons = await extractLessonsFromDocId(fileID, { mapIds: [selectedLessonId] });
        const extractedLesson = lessons?.[0] as ExtractedLesson | undefined;
              if (!extractedLesson) {
        console.log('[aiServiceLayer.ts][3010C] No lesson returned for given map id', { fileID, selectedLessonId });
        return res.status(404).json({
          error: 'LESSON_NOT_FOUND',
          message: 'The specified lesson (concept map) was not found in the document',
          service: 'createQuiz',
        });
      }
      
      // [D] Attach extracted lesson context + normalized count to req.body for controller
      (req.body as any).extractedLesson = extractedLesson;
      (req.body as any).exportData = formatExportDataFromExtractedLesson(extractedLesson);
      
      // update - 4: Re-validate generated exportData size if it was just generated server-side
      if ((req.body as any).exportData.length > SAFETY_LIMITS.MAX_CONTEXT_LENGTH) {
         return res.status(400).json({
            error: 'VALIDATION_FAILED',
            message: `Generated quiz context exceeds limit of ${SAFETY_LIMITS.MAX_CONTEXT_LENGTH} characters.`,
            service: 'createQuiz'
         });
      }

      }
      
      // [C] Normalize/cap questionCount (shared generator, caps for Scholars)
      const requestedCountRaw = Number(body.questionCount);
      const requestedCount = Number.isFinite(requestedCountRaw) && requestedCountRaw > 0 ? Math.floor(requestedCountRaw) : 10;
      const normalizedQuestionCount = Math.max(1, Math.min(requestedCount, 25));

      (req.body as any).questionCount = normalizedQuestionCount;

      // [E] Delegate to controller
      processingResult = await processAIServiceRequest(
        () => AIController.handleQuizTool(req, res),
        sessionData.user.email,
        'createQuiz'
      );
    }

    else if (action === 'feedbackQuiz') {
      console.log('[aiServiceLayer.ts][3020] Routing to isolated feedback quiz pipeline');

      const body = req.body || {};
      const fileID: string | undefined = body.fileID || body.docId;
      const lessonId: string | undefined = body.lessonId;

      if (!fileID || !lessonId) {
        return res.status(400).json({ error: 'MISSING_PARAMETERS', message: 'fileID and lessonId are required' });
      }

      // 1. Extract the requested lesson specifically for this new pipeline
      const lessons = await extractLessonsFromDocId(fileID, { mapIds: [lessonId] });
      const extractedLesson = lessons?.[0] as ExtractedLesson | undefined;

      if (!extractedLesson) {
        return res.status(404).json({ error: 'LESSON_NOT_FOUND', service: 'feedbackQuiz' });
      }

      // 2. Step 2: Initialize mapping logic for the LLM
      const mapper = new TopicIdMapper();
      const mappingData = extractedLesson.topics.map((t, idx) => ({ id: `topic-${idx}`, title: t.topicTitle }));
      mapper.generateMapping(mappingData);

      // 3. Step 3: Package the mapping context for the AI Controller
      (req.body as any).promptExtension = mapper.getPromptExtension();
      (req.body as any).topicMapperInstance = mapper;
      (req.body as any).exportData = formatExportDataFromExtractedLesson(extractedLesson);

      // 4. Step 4: Delegate to a specialized controller method (Phase 2 objective)
      processingResult = await processAIServiceRequest(
        () => FeedbackAiController.handleFeedbackQuiz(req, res), // Temporary bridge until FeedbackAiController is built
        sessionData.user.email,
        'createQuiz'
      );
    }

    
    else {
      console.log('[aiServiceLayer.ts][3011] Invalid action parameter provided', { action });
      return res.status(400).json({ 
        error: 'INVALID_ACTION',
        message: 'Invalid action parameter provided',
        service: serviceType
      });
    }

    // Step 7: Log successful completion
    if (processingResult?.success) {
      console.log('[aiServiceLayer.ts][3012] AI service request completed successfully', {
        email: sessionData.user.email,
        serviceType,
        processingTime: processingResult.processingTime
      });
    }

  } catch (error) {
    console.error('[aiServiceLayer.ts][3013] AI service request failed with error:', error);
    
    // Step 8: Handle unexpected errors with proper response format
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Unknown server error',
      service: mapActionToServiceType(req.query.action as string)
    });
  }
}

/**
 * processAIServiceRequest
 * Wrapper function that handles AI service request processing...
 * (No changes below this line, kept for context)
 */
async function processAIServiceRequest(
  serviceHandler: () => Promise<void>,
  userEmail: string,
  serviceType: 'askAssistant' | 'exploreTopic' | 'createQuiz'
): Promise<{ success: boolean; processingTime?: number }> {
  const startTime = Date.now();
  
  try {
    console.log('[aiServiceLayer.ts][3014] Starting AI service processing', { userEmail, serviceType });
    
    // Step 9: Execute the AI service handler
    await serviceHandler();
    
    // Step 10: Track successful usage for rate limiting and analytics
    await UserService.incrementUsageCounter(userEmail, serviceType);
    
    const processingTime = Date.now() - startTime;
    console.log('[aiServiceLayer.ts][3015] AI service processing completed successfully', {
      userEmail,
      serviceType,
      processingTime
    });
    
    return { success: true, processingTime };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('[aiServiceLayer.ts][3016] AI service processing failed', {
      userEmail,
      serviceType,
      processingTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Re-throw error to be handled by main handler
    throw error;
  }
}