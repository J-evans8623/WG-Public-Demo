/**
 * sseHelpers.ts
 *
 * Helpers for Server-Sent-Events (SSE) streaming in Next.js API routes.
 *
 * Responsibilities:
 *  - initSSE: initialize response headers for SSE and send a first ping.
 *  - pushEvent: send a named event with JSON data over the open SSE connection.
 */

import { NextApiResponse } from 'next';

export function initSSE(res: NextApiResponse) {
  // Required headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  // Heartbeat to keep the connection alive
  res.write(':\n\n');
}

export function pushEvent(res: NextApiResponse, event: string, data: any) {
  const payload = JSON.stringify(data);
  res.write(`event: ${event}\n`);
  res.write(`data: ${payload}\n\n`);
}
