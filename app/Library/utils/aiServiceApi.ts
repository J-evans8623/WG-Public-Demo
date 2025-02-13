/**
 * aiServiceAPI.ts
 *
 * This utility file provides functions for making secure API calls from the frontend
 * to the centralized AI service layer. It handles operations for:
 *   - Retrieving the lesson module list associated with a specific document (bloomdocx)
 *   - Requesting AI-generated lesson content based on a selected lesson module
 *   - Requesting AI-generated quiz content (using the lesson module)
 *   - Asking a question based on highlighted text
 *
 * All API calls include credentials as per our OAuth 2 PKCE guidelines.
 */

export async function getLessonListAPI(documentID: string) {
    console.log('aiServiceApi.ts invoking getLessonListAPI(documentID: string) ..... with ID', documentID)
    const response = await fetch(
      `/api/aiServiceLayer?action=getLessonList&documentID=${encodeURIComponent(documentID)}`,
      {
        credentials: 'include',
      }
    );
    if (!response.ok) {
      throw new Error('Failed to fetch lesson list');
    }
    return await response.json();
  }
  
  export async function askQuestionAPI(textSelection: string, question: string) {
    const response = await fetch('/api/aiServiceLayer?action=question', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ textSelection, question }),
    });
    if (!response.ok) {
      throw new Error('Failed to ask question');
    }
    return await response.json();
  }
  
  /**
   * generateAILesson
   *
   * Requests the backend to generate a lesson based on a preprocessed lesson module.
   * The request includes the documentID (the bloomdocx instance) and the moduleID (the specific lesson module).
   *
   * Steps:
   * 1. Send a POST request to the "/api/aiServiceLayer?action=newLesson" endpoint.
   * 2. Include the documentID and moduleID in the JSON request body.
   * 3. Return the generated lesson content as a JSON response.
   *
   * @param documentID - The ID of the bloomdocx instance.
   * @param moduleID - The ID of the lesson module to generate.
   * @returns A promise that resolves to the generated lesson content.
   */
  export async function generateAILesson(documentID: string, moduleID: string) {
    const response = await fetch('/api/aiServiceLayer?action=newLesson', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentID, moduleID }),
    });
    if (!response.ok) {
      throw new Error('Failed to generate AI lesson');
    }
    return await response.json();
  }
  
  /**
   * generateAIQuiz
   *
   * Requests the backend to generate a quiz based on a preprocessed lesson module.
   * The request includes the documentID (the bloomdocx instance) and the moduleID (the specific lesson module)
   * to create a quiz using the repurposed AI Service layer.
   *
   * Steps:
   * 1. Send a POST request to the "/api/aiServiceLayer?action=newQuiz" endpoint.
   * 2. Include the documentID and moduleID in the JSON request body.
   * 3. Return the generated quiz content as a JSON response.
   *
   * @param documentID - The ID of the bloomdocx instance.
   * @param moduleID - The ID of the lesson module for which the quiz is to be generated.
   * @returns A promise that resolves to the generated quiz content.
   */
  export async function generateAIQuiz(documentID: string, moduleID: string) {
    const response = await fetch('/api/aiServiceLayer?action=newQuiz', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentID, moduleID }),
    });
    if (!response.ok) {
      throw new Error('Failed to generate AI quiz');
    }
    return await response.json();
  }
  