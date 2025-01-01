// bloom-maps/app/Library/utils/api.ts

/**
 * api.ts
 * 
 * Handles API requests to the backend, including attaching JWTs to requests.
 */

// api.ts
import axios from 'axios';

export enum QuizType {
  MULTIPLE_CHOICE = 'multipleChoice',
  MATCHING = 'matching',
  FILL_IN_BLANK = 'FIB',
  TRUE_FALSE = 'true-false'
}


const apiServerUrl = process.env.NEXT_PUBLIC_API_SERVER_URL || 'http://localhost:5000';

interface BaseAIRequest {
  type: 'text' | 'pdf';
  token: string;
}

interface TextAIRequest extends BaseAIRequest {
  type: 'text';
  text: string; // Changed from 'content' to 'text' to match backend
}

interface PDFAIRequest extends BaseAIRequest {
  type: 'pdf';
  file: File;
}

type AIRequest = TextAIRequest | PDFAIRequest;

async function makeAIRequest(
  endpoint: string,
  request: AIRequest
): Promise<any> {
  try {
    let response;
    const headers = {
      'Authorization': `Bearer ${request.token}`
    };

    if (request.type === 'text') {
      response = await axios.post(
        endpoint,
        { text: request.text }, // Changed to match backend expectation
        { headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    } else {
      const formData = new FormData();
      formData.append('file', request.file);
      response = await axios.post(
        endpoint,
        formData,
        { headers: { ...headers, 'Content-Type': 'multipart/form-data' } }
      );
    }

    // Return the raw response data without wrapping
    return response.data;
  } catch (error: any) {
    console.error(`AI Service Error (${endpoint}):`, error);
    throw new Error(error.response?.data?.message || 'Failed to process request');
  }
}

function createAIRequest(
  input: string | File,
  type: 'text' | 'pdf',
  token: string
): AIRequest {
  if (type === 'text') {
    if (typeof input !== 'string') {
      throw new Error('Text input must be a string');
    }
    return {
      type: 'text',
      text: input, // Changed from 'content' to 'text'
      token
    } as TextAIRequest;
  } else {
    if (!(input instanceof File)) {
      throw new Error('PDF input must be a File');
    }
    return {
      type: 'pdf',
      file: input, // Changed from 'content' to 'file'
      token
    } as PDFAIRequest;
  }
}

export const generateAIContent = async (
  data: {
    option: 'Lesson' | 'Quiz';
    quizType?: QuizType;
    inputType: 'text' | 'pdf';
    text?: string;
    pdf?: File;
  },
  token: string
): Promise<any> => {
  const input = data.inputType === 'text' ? data.text! : data.pdf!;
  let endpoint = `${apiServerUrl}/api/generate-${data.option.toLowerCase()}`;
  
  // Add quiz type to endpoint if it's a quiz
  if (data.option === 'Quiz' && data.quizType) {
    endpoint += `/${data.quizType}`;
  }
  
  const request = createAIRequest(input, data.inputType, token);
  return makeAIRequest(endpoint, request);
};