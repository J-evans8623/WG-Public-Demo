
/**
 * aiServiceAPI.ts 
 *
 * This utility file provides functions for making secure API calls from the frontend
 * to the centralized AI service layer.
 * All API calls include credentials as per our OAuth 2.0 PKCE guidelines.
 *
 * UPDATED FUNCTION:
 *   - generateAILesson now points to the new /api/GenerateLesson endpoint and accepts a File.
 */

import { apiService } from "@/app/src/services/ApiService";

export async function askQuestionAPI(
  question: string,
  textSelection: string,
  fileID: string
): Promise<any> {
  const payload = { question, textSelection, fileID };
  console.log('[aiServiceAPI] askQuestionAPI payload:', payload);
  const response = await fetch('/api/aiServiceLayer?action=question', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    console.error('[aiServiceAPI] askQuestionAPI failed');
    throw new Error('Failed to ask question');
  }
  const data = await response.json();
  console.log('[aiServiceAPI] askQuestionAPI response:', data);
  return data;
}

/**
 * generateAILesson
 * @description
 * UPDATED: Enhanced lesson generation function that now supports the new account type abstraction
 * and visibility controls. This function accepts visibility parameters and enforces the business
 * rule that only Educator accounts can create public lessons while Scholar accounts are restricted
 * to private lessons only. The function constructs proper FormData requests for file uploads and
 * integrates seamlessly with the updated GenerateLesson.ts endpoint.
 */
export async function generateAILesson(
  file: File, 
  docId: string, 
  options: { isPublic?: boolean } = {}
): Promise<any> {
  console.log('[aiServiceApi.ts] generateAILesson delegating to apiService', { docId, isPublic: options.isPublic });

  const response = await apiService.generateLesson(file, docId, options);

  if (!response.success || !response.data) {
    // apiService handled the 403 OWNER_ACCESS_RESTRICTED and emitted the event.
    // The ModalEventManager will catch that event and show the Subscribe modal.
    console.error('[aiServiceApi.ts] generateAILesson failed via apiService', response.error);
    throw new Error(response.error?.message || 'Failed to generate AI lesson');
  }

  return response.data;
}
/**
 * generateQuiz
 * Sends a quiz generation request to the backend.
 */
export async function generateQuiz(payload: {
  quizTypes: string[];
  fileID: string;
  questionCount?: number;
  lessonId?: string;
  topicIds?: string[];
  exportData?: string;
  textSelection?: string;
}): Promise<any> {
  // update - 1
  const body: Record<string, any> = { ...payload };
  if (!body.topicIds && body.lessonId) {
    body.topicIds = [body.lessonId];
  }
  console.log('[aiServiceApi.ts][4105] generateQuiz payload shaped', {
    fileID: body.fileID,
    quizTypes: body.quizTypes,
    hasLessonId: !!payload.lessonId,
    topicIdsLen: Array.isArray(body.topicIds) ? body.topicIds.length : 0,
    questionCount: body.questionCount ?? null,
  });

  const response = await fetch('/api/aiServiceLayer?action=quizGenerator', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[aiServiceApi.ts][4193] generateQuiz failed', { status: response.status, errorText });
    throw new Error('Failed to generate quiz');
  }

  const data = await response.json();
  console.log('[aiServiceApi.ts][4106] generateQuiz ok');
  return data;
}

/**
 * generateTopic
 * Sends a topic generation request to the backend.
 */
export async function generateTopic(
  userTopicRequest: string,
  exportData: any,
  fileID: string,
  textSelection?: string,
): Promise<any> {
  const payload: any = {
    userTopicRequest,
    exportData,
    fileID,
  };
  if (textSelection) {
    payload.textSelection = textSelection;
  }
  console.log('[aiServiceAPI] generateTopic payload:', payload);
  const response = await fetch('/api/aiServiceLayer?action=generateTopic', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    console.error('[aiServiceAPI] generateTopic failed');
    throw new Error('Failed to generate topic');
  }
  const data = await response.json();
  console.log('[aiServiceAPI] generateTopic response:', data);
  return data;
}