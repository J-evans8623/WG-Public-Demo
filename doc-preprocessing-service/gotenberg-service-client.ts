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
import { marked } from 'marked';

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




/**
 * Converts a raw Markdown string to a PDF Buffer.
 *
 * Strategy:
 *   1. Use `marked` to render Markdown → HTML on the Node.js side.
 *   2. Wrap the HTML fragment in a complete, self-contained HTML document with inline
 *      CSS so the output is readable without any external assets.
 *   3. POST the single HTML file to Gotenberg's Chromium HTML endpoint
 *      (`/forms/chromium/convert/html`) using the correct multipart field name ("files").
 *
 * This avoids the Go-template `{{.Content}}` mechanism and the field-name mismatch
 * that caused the previous 500 errors on the markdown endpoint.
 *
 * @param markdown - The raw Markdown string to convert.
 * @returns A Promise that resolves to a Buffer containing the generated PDF.
 */
export async function convertMarkdownToPdf(markdown: string): Promise<Buffer> {
  // Step 1: Pre-render Markdown → HTML fragment using `marked`.
  // marked.parse returns string | Promise<string> depending on version;
  // we await to handle both cases safely.
  const htmlFragment = await Promise.resolve(marked.parse(markdown));

  // Step 2: Wrap in a complete HTML document with inline styles.
  // No external resources means Gotenberg's Chromium sandbox has nothing to fetch,
  // which eliminates a common source of timeouts and silent failures.
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>YouTube Source Compilation</title>
  <style>
    /* ---------- Reset & Base ---------- */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 13pt;
      line-height: 1.7;
      color: #1a1a1a;
      background: #ffffff;
      padding: 40px 60px;
      max-width: 900px;
      margin: 0 auto;
    }

    /* ---------- Headings ---------- */
    h1 { font-size: 22pt; margin-bottom: 8px; color: #111; border-bottom: 2px solid #ddd; padding-bottom: 6px; }
    h2 { font-size: 17pt; margin-top: 32px; margin-bottom: 6px; color: #222; }
    h3 { font-size: 14pt; margin-top: 20px; margin-bottom: 4px; color: #333; }

    /* ---------- Body copy ---------- */
    p  { margin-top: 10px; margin-bottom: 10px; }
    em { font-style: italic; color: #555; }
    strong { font-weight: 700; }

    /* ---------- Links ---------- */
    a  { color: #1a6db5; word-break: break-all; }

    /* ---------- Horizontal Rule ---------- */
    hr {
      border: none;
      border-top: 1px solid #ccc;
      margin: 28px 0;
    }

    /* ---------- Code ---------- */
    code {
      font-family: "Courier New", monospace;
      font-size: 11pt;
      background: #f4f4f4;
      padding: 1px 4px;
      border-radius: 3px;
    }
    pre {
      background: #f4f4f4;
      padding: 12px 16px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 12px 0;
    }
    pre code { background: none; padding: 0; }

    /* ---------- Blockquote ---------- */
    blockquote {
      border-left: 4px solid #aaa;
      padding-left: 14px;
      color: #555;
      margin: 12px 0;
    }
  </style>
</head>
<body>
${htmlFragment}
</body>
</html>`;

  // Step 3: Build multipart form for Gotenberg's HTML endpoint.
  // CRITICAL: the field name must be "files" (not "index.html") so Gotenberg
  // recognises it as a file upload rather than a configuration key.
  const serviceUrl =
    process.env.GOTENBERG_SERVICE_URL_MD ||
    'http://localhost:3001/forms/chromium/convert/html';

  const form = new FormData();
  form.append('files', Buffer.from(fullHtml, 'utf-8'), { filename: 'index.html' });

  try {
    const response = await axios.post(serviceUrl, form, {
      headers: { ...form.getHeaders() },
      responseType: 'arraybuffer',
    });

    return Buffer.from(response.data);
  } catch (error: any) {
    // Decode Gotenberg's terse error body (typically ~21 bytes) so it surfaces in logs.
    const gotenbergMessage =
      error?.response?.data instanceof Buffer || error?.response?.data instanceof ArrayBuffer
        ? Buffer.from(error.response.data).toString('utf-8').trim()
        : error?.response?.statusText ?? 'unknown';

    console.error(
      '[GotenbergClient] HTML→PDF conversion failed:',
      `HTTP ${error?.response?.status ?? '?'} — "${gotenbergMessage}"`,
      error
    );

    throw new Error(
      `Failed to standardize source content into PDF. Gotenberg responded: "${gotenbergMessage}"`
    );
  }
}
