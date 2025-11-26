/**
 * @file text_extraction_client.ts
 * @description
 * Client for invoking the Text Extraction microservice.
 * Uses DOC_PROCESSING_URL from environment (docker-compose).
 */
import axios from 'axios';
import FormData from 'form-data';

export async function extractTextFromFileService(fileBuffer: Buffer, mimeType: string): Promise<string[]> {
  // SIMPLIFIED LOGIC:
  // 1. Use the Docker service URL if available (Production/Docker)
  // 2. Fallback to localhost (Local Dev)
  const baseUrl = process.env.DOC_PROCESSING_URL || 'http://localhost:8000'; 
  const serviceUrl = `${baseUrl}/extract`;

  // Debug log to verify where it's trying to connect
  console.log('[TextExtractionClient] Connecting to:', serviceUrl);
  
  const form = new FormData();
  form.append('file', fileBuffer, { filename: `upload.${mimeType}` });
  form.append('fileType', mimeType);

  try {
    const response = await axios.post(serviceUrl, form, {
      headers: {
        ...form.getHeaders(),
      },
      responseType: 'json',
    });
    return response.data.text;
  } catch (error: any) {
    console.error('[TextExtractionClient] Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
       console.error(`[TextExtractionClient] Could not connect to ${serviceUrl}. Is the doc-processor container running?`);
    }
    throw error;
  }
}