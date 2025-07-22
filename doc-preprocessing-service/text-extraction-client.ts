/**
 * @file text_extraction_client.ts
 * @description
 *   Client for invoking the Text Extraction microservice.
 *   This file exports the `extractTextFromFileService` function that sends the original file
 *   (as a Buffer and its MIME type) to the text extraction service and returns the extracted text.
 *
 *   In production, the URL for the text extraction service should be configured via an
 *   environment variable (e.g., TEXT_EXTRACTION_SERVICE_URL).
 */
import axios from 'axios';
import FormData from 'form-data';

export async function extractTextFromFileService(fileBuffer: Buffer, mimeType: string): Promise<string[]> {
  const serviceUrl = process.env.TEXT_EXTRACTION_SERVICE_URL || 'http://localhost:8001/extract';
  
  const form = new FormData();
  form.append('file', fileBuffer, { filename: `upload.${mimeType}` });
  // Append the file type explicitly
  form.append('fileType', mimeType);

  const response = await axios.post(serviceUrl, form, {
    headers: {
      ...form.getHeaders(),
    },
    responseType: 'json',
  });
  
  return response.data.text;
}
