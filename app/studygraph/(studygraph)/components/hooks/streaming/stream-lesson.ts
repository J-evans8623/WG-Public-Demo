// stream-lesson.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import mongoose from 'mongoose';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import connectDB from '@/app/src/config/db';
import { extractTextFromFileService } from '@/doc-preprocessing-service/text-extraction-client';
import { generateLessonStream } from '@/app/src/controllers/aiController';

export const config = {
  api: {
    bodyParser: false,
    // tell Next that we're streaming and handling the response ourselves
    externalResolver: true,
  },
};

/**
 * loadPdfBuffer
 * -------------
 * Connects to MongoDB, reads the given fileId from GridFS, and
 * concatenates all chunks into a single Buffer.
 */
async function loadPdfBuffer(fileId: string): Promise<Buffer> {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established');
  }
  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'files' });
  const objectId = new mongoose.Types.ObjectId(fileId);
  const downloadStream = bucket.openDownloadStream(objectId);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    downloadStream.on('data', (chunk: Buffer) => chunks.push(chunk));
    downloadStream.on('error', reject);
    downloadStream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * splitTextIntoSegments
 * ---------------------
 * Slices the full text into up to `maxSegments` roughly equal parts.
 */
function splitTextIntoSegments(fullText: string, maxSegments = 1): string[] {
  const segmentSize = Math.ceil(fullText.length / maxSegments);
  const segments: string[] = [];
  for (let i = 0; i < fullText.length; i += segmentSize) {
    segments.push(fullText.slice(i, i + segmentSize));
  }
  return segments;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1) Only GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // 2) Authenticate
  const session = await authenticateRequest(req, res);
  if (!session) return;

  // 3) Parse query
  const { fileId, docId } = req.query as { fileId?: string; docId?: string };
  if (!fileId) return res.status(400).json({ error: 'Missing query parameter: fileId' });
  if (!docId) return res.status(400).json({ error: 'Missing query parameter: docId' });

  // 4) Load PDF
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await loadPdfBuffer(fileId);
  } catch (err) {
    console.error('[stream-lesson] loadPdfBuffer error:', err);
    return res.status(500).json({ error: 'Failed to load PDF from storage' });
  }

  // 5) Extract text
  let fullText: string;
  try {
    fullText = await extractTextFromFileService(pdfBuffer, '.pdf');
  } catch (err) {
    console.error('[stream-lesson] extractText error:', err);
    return res.status(500).json({ error: 'Failed to extract text from PDF' });
  }
  if (!fullText.trim()) {
    return res.status(400).json({ error: 'No text extracted from PDF' });
  }

  // 6) Segment text
  const segments = splitTextIntoSegments(fullText, 1);  // Start with just 1 segment for testing

  // 7) Setup streaming response
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');  // Explicitly set chunked transfer encoding
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  
  // Explicitly disable any compression middleware
  res.setHeader('X-No-Compression', 'true');
  
  // Explicitly turn off Nagle algorithm (as you already had)
  if (res.socket) {
    res.socket.setNoDelay(true);
  }
  
  // Flush headers immediately
  res.flushHeaders();

  // 8) Stream response chunks
  try {
    let chunkCount = 0;
    
    for await (const chunk of generateLessonStream(segments, docId, fileId)) {
      // IMPORTANT FIX: Don't wrap in 'lessonChunk' type, pass chunk directly
      const data = JSON.stringify(chunk) + '\n';
      
      // Write each chunk and force flush
      res.write(data);
      chunkCount++;
      
      // Log for debugging
      console.log(`[stream-lesson] Sent chunk #${chunkCount}: ${chunk.event} (${data.length} bytes)`);
      
      // Explicitly flush after each chunk - both methods for compatibility
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
      
      // Some environments use different flush methods
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }
    }
    
    console.log(`[stream-lesson] Stream complete, sent ${chunkCount} chunks`);
    
    // End the response
    res.end();
  } catch (err) {
    console.error('[stream-lesson] streaming error:', err);
    // Try to send error to client
    try {
      const errorMsg = { event: 'error', data: { message: 'Stream processing error' } };
      res.write(JSON.stringify(errorMsg) + '\n');
    } catch (writeErr) {
      console.error('[stream-lesson] Failed to write error message:', writeErr);
    }
    // End the response
    res.end();
  }
}