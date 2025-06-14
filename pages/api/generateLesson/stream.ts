/**
 * pages/api/GenerateLesson/stream.ts
 *
 * Responsibilities:
 *  - Authenticate incoming GET requests.
 *  - Read `fileId` from query.
 *  - Subscribe to the shared JobBus async generator for that fileId.
 *  - Stream each chunk as SSE over this response, including periodic heartbeats.
 *  - Clean up the JobBus entry once the generator completes.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { jobBus, LessonChunk } from '@/app/src/utils/lessonJobBus';

/** Simple helper to write an SSE frame */
function sendSSE(res: NextApiResponse, chunk: LessonChunk) {
  if (chunk.id) {
    res.write(`id: ${chunk.id}\n`);
  }
  if (chunk.event) {
    res.write(`event: ${chunk.event}\n`);
  }
  res.write(`data: ${JSON.stringify(chunk.data)}\n\n`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // 1) Authenticate
  const session = await authenticateRequest(req, res);
  if (!session) return;

  // 2) Validate fileId
  const fileId = Array.isArray(req.query.fileId)
    ? req.query.fileId[0]
    : req.query.fileId;
  if (!fileId) {
    return res.status(400).json({ error: 'Missing fileId query parameter' });
  }

  // 3) Subscribe to the job
  let iterator;
  try {
    iterator = jobBus.subscribe(fileId);
  } catch (err: any) {
    return res.status(404).json({ error: err.message });
  }

  // 4) Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // 5) Heartbeat ping every 15s to keep connection alive
  const pingInterval = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 15_000);

  // 6) Forward generator chunks as SSE
  try {
    for await (const chunk of iterator) {
      sendSSE(res, chunk);
    }
    // optional final event
    res.write(`event: endOfStream\ndata: {}\n\n`);
  } catch (err) {
    console.error('[GenerateLesson/stream] error:', err);

  } finally {
    clearInterval(pingInterval);
    jobBus.delete(fileId);
    res.end();
  }
}
