
/**
 * aiServiceAPI.ts (OUTDATED VERSION)
 *
 * This utility file provides functions for making secure API calls from the frontend
 * to the centralized AI service layer.
 * All API calls include credentials as per our OAuth 2.0 PKCE guidelines.
 *
 * UPDATED FUNCTION:
 *   - generateAILesson now points to the new /api/GenerateLesson endpoint and accepts a File.
 */

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
  // Step 4: Extract visibility preference with default to private for security
  const { isPublic = false } = options;
  
  console.log('[aiServiceApi.ts][4005] generateAILesson initiated - File:', file.name, 'Size:', file.size, 'DocID:', docId, 'Public:', isPublic);

  try {
    // Step 5: Construct FormData with enhanced parameter support
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileID', docId);
    
    // Step 6: Add visibility parameter for new account type system
    formData.append('visibility', isPublic ? 'public' : 'private');
    
    console.log('[aiServiceApi.ts][4006] FormData constructed with visibility parameter');

    // Step 7: Send request to updated GenerateLesson endpoint
    const response = await fetch('/api/GenerateLesson', {
      method: 'POST',
      credentials: 'include', // Essential for session-based authentication
      body: formData, // No Content-Type header needed for FormData
    });

    // Step 8: Enhanced error handling with account type awareness
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[aiServiceApi.ts][4007] generateAILesson failed - Status:', response.status, 'Error:', errorText);
      
      // Step 9: Parse error response for detailed user feedback
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (parseError) {
        errorData = { error: 'Unknown error', message: errorText };
      }

      // Step 10: Handle specific permission errors for visibility restrictions
      if (response.status === 403) {
        if (errorData.reason?.includes('cannot create public files')) {
          throw new Error('Scholar accounts can only create private lessons. Please set visibility to private or upgrade to Educator account.');
        } else if (errorData.reason?.includes('rate limit')) {
          throw new Error(`Rate limit exceeded. ${errorData.reason}`);
        } else if (errorData.code === 'UPLOAD_PERMISSION_DENIED') {
          throw new Error(`Upload permission denied: ${errorData.reason}`);
        }
      }

      throw new Error(errorData.message || errorData.error || 'Failed to generate AI lesson');
    }

    // Step 11: Process successful response with enhanced logging
    const data = await response.json();
    console.log('[aiServiceApi.ts][4008] generateAILesson completed successfully - Lesson modules:', data.lessonModules?.length || 0);
    
    // Step 12: Log usage information for analytics and debugging
    if (data.usageInfo) {
      console.log('[aiServiceApi.ts][4009] Usage tracking - Account:', data.usageInfo.accountType, 'Tier:', data.usageInfo.subscriptionTier);
      
      if (data.usageInfo.remainingDemoCredits !== undefined) {
        console.log('[aiServiceApi.ts][4010] Demo credits remaining:', data.usageInfo.remainingDemoCredits);
      }
      
      if (data.usageInfo.rateLimitInfo) {
        console.log('[aiServiceApi.ts][4011] Rate limit status - Hourly:', data.usageInfo.rateLimitInfo.hourlyRemaining, 'Monthly:', data.usageInfo.rateLimitInfo.monthlyRemaining);
      }
    }

    return data;

  } catch (error) {
    console.error('[aiServiceApi.ts][4012] generateAILesson error:', error);
    throw error;
  }
}

/**
 * generateQuiz
 * Sends a quiz generation request to the backend.
 */
export async function generateQuiz(payload: {
  topicIds: string[];
  quizTypes: string[];
  fileID: string;
  exportData: string;
  textSelection?: string;
}): Promise<any> {
  console.log('[aiServiceAPI] generateQuiz payload:', payload);
  const response = await fetch('/api/aiServiceLayer?action=quizGenerator', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    console.error('[aiServiceAPI] generateQuiz failed');
    throw new Error('Failed to generate quiz');
  }
  const data = await response.json();
  console.log('[aiServiceAPI] generateQuiz response:', data);
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