/**
 * @file gotenberg_service_client.ts
 * @description
 *   Interface wrapper for the Gotenberg Docker image.
 *   This file exports a single external method, convertFileToPdf, that sends a file buffer
 *   (and its type, e.g. 'docx', 'pptx', or 'txt') to the Gotenberg conversion endpoint and returns
 *   the converted PDF as a Buffer.
 *
 *   In production, the URL for the conversion service should be configured via an environment variable
 *   (e.g., GOTENBERG_SERVICE_URL). In its absence, we fall back to "http://localhost:3001/convert" so that
 *   it does not conflict with your front-end on port 3000.
 */

import axios from 'axios';
import FormData from 'form-data';

/**
 * Converts a file to PDF by forwarding the file buffer to the Gotenberg conversion API.
 *
 * @param fileBuffer - The original file as a Buffer (for example, the contents of example.docx).
 * @param fileType - The type of the file, e.g. 'docx', 'pptx', or 'txt'.
 * @returns A Promise that resolves to a Buffer containing the converted PDF data.
 */
export async function convertFileToPdf(fileBuffer: Buffer, fileType: string): Promise<Buffer> {
  // Use GOTENBERG_SERVICE_URL if provided; otherwise, default to the Gotenberg container running on localhost:3001.
  const serviceUrl = process.env.GOTENBERG_SERVICE_URL || 'http://localhost:3001/forms/libreoffice/convert';
  
  const form = new FormData();
  form.append('file', fileBuffer, { filename: `upload.${fileType}` });
  
  const response = await axios.post(serviceUrl, form, {
    headers: {
      ...form.getHeaders(),
    },
    responseType: 'arraybuffer',
  });
  
  return Buffer.from(response.data);
}
