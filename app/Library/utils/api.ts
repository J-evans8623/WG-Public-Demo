// bloom-maps/app/Library/utils/api.ts

/**
 * api.ts
 * 
 * Handles API requests to the backend, including attaching JWTs to requests.
 */

import axios from 'axios';

/**
 * Interface for AI Content Generation Request
 */
interface GenerateAIContentRequest {
  option: 'Lesson' | 'Quiz';
  inputType: 'text' | 'pdf';
  text?: string;
  pdf?: File;
}

/**
 * Interface for AI Content Generation Response
 */
interface GenerateAIContentResponse {
  status: 'success' | 'error';
  content?: string; // AI-generated text for Lesson or Quiz
  message?: string; // Error message if any
}

/**
 * Generates AI content by sending user input to the backend.
 * 
 * @param data - The AI generation request data.
 * @param token - The user's JWT token for authentication.
 * @returns The response data from the backend.
 */
export const generateAIContent = async (
  data: GenerateAIContentRequest,
  token: string
): Promise<GenerateAIContentResponse> => {
  try {
    let response;

    if (data.inputType === 'text') {
      // Send JSON payload for text input
      response = await axios.post<GenerateAIContentResponse>(
        '/api/generate-ai',
        {
          option: data.option,
          text: data.text,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );
    } else if (data.inputType === 'pdf' && data.pdf) {
      // Send multipart/form-data for PDF upload
      const formData = new FormData();
      formData.append('option', data.option);
      formData.append('pdf', data.pdf);

      response = await axios.post<GenerateAIContentResponse>(
        '/api/generate-ai',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`,
          },
        }
      );
    } else {
      throw new Error('Invalid input data.');
    }

    return response.data;
  } catch (error: any) {
    console.error('Error in generateAIContent:', error);
    return {
      status: 'error',
      message: error.response?.data?.error || 'Failed to generate AI content.',
    };
  }
};
