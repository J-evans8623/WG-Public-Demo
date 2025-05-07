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
 * 
 * Updated to point to the new /api/GenerateLesson endpoint.
 * Accepts a File object from the frontend, builds a FormData payload, and sends the request
 * with credentials included.
 */
export async function generateAILesson(file: File, docId:string): Promise<any> {
  console.log('[aiServiceAPI] generateAILesson called with file:', file.name);
  const formData = new FormData();
  formData.append('file', file);
  formData.append('fileID', docId); // <--- This is an AI generated bug 

  const response = await fetch('/api/GenerateLesson', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!response.ok) {
    console.error('[aiServiceAPI] generateAILesson failed');
    throw new Error('Failed to generate AI lesson');
  }
  const data = await response.json();
  console.log('[aiServiceAPI] generateAILesson response:', data);
  return data;
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
