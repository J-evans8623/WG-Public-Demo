/**
 * @file bloom-maps/pages/api/GenerateLesson.ts
 * @description
 *   API endpoint for lesson generation.
 *   This endpoint accepts a file upload dedicated for lesson generation,
 *   converts the file to PDF (if necessary), stores the PDF in GridFS,
 *   extracts text, splits it into segments, and concurrently generates lesson modules.
 *
 *   SECURITY UPDATE:
 *     The endpoint now validates the incoming request using the OAuth 2.0 PKCE security layer.
 *     It uses the authenticateRequest helper to ensure that only authenticated sessions are allowed.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import type { GridFSBucket } from 'mongodb';
import mongoose from 'mongoose';
import multer from 'multer';
import connectDB from '@/app/src/config/db';
import { convertFileToPdf } from '@/doc-preprocessing-service/gotenberg-service-client';
import { extractTextFromFileService } from '@/doc-preprocessing-service/text-extraction-client';
import { generateLessonFromSegment } from '@/app/src/services/TextPreprocessing/LessonModuleServiceV2';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { v4 as uuidv4 } from 'uuid';

/**
 * NextApiRequestWithFile
 * Extends NextApiRequest to include a `file` property (added by Multer).
 */
interface NextApiRequestWithFile extends NextApiRequest {
  file?: Express.Multer.File;
}

interface ProcessedFile {
  buffer: Buffer;
  type: 'pdf' | 'docx' | 'txt';
  contentType: string;
}

interface StoredFile {
  id: string;
  url: string;
  type: 'pdf';
  title: string;
  size: number;
}

// Configure Multer for file uploads.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, TXT, DOC, DOCX, and PPTX files are allowed'));
    }
  },
});

// Internal GridFS bucket reference.
let bucket: GridFSBucket;
let isInitialized = false;

/**
 * initBucket
 * Initializes the GridFS bucket if not already done.
 */
async function initBucket() {
  if (isInitialized && bucket) return;
  try {
    await connectDB();
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'files' });
    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize GridFS bucket:', error);
    throw error;
  }
}

/**
 * processFile
 * Processes the uploaded file buffer based on its MIME type.
 */
async function processFile(file: Buffer, mimeType: string): Promise<ProcessedFile> {
  switch (mimeType) {
    case 'application/pdf':
      return { buffer: file, type: 'pdf', contentType: mimeType };
    case 'application/msword':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.ms-powerpoint':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    case 'text/plain':
      return { buffer: file, type: 'docx', contentType: mimeType };
    default:
      throw new Error('Unsupported file type');
  }
}

/**
 * storeFile
 * Stores the processed PDF file in GridFS and returns a StoredFile object.
 */
async function storeFile(processed: ProcessedFile, originalName: string, size: number): Promise<StoredFile> {
  const filename = `${Date.now()}-${originalName}`;
  const uploadStream = bucket.openUploadStream(filename, {
    contentType: 'application/pdf',
    metadata: { originalName, type: 'pdf', size },
  });

  await new Promise<void>((resolve, reject) => {
    uploadStream.on('error', reject);
    uploadStream.on('finish', resolve);
    uploadStream.end(processed.buffer);
  });

  return {
    id: uploadStream.id.toString(),
    url: `/api/FileAssets?id=${uploadStream.id}`,
    type: 'pdf',
    title: originalName,
    size
  };
}

/**
 * splitTextIntoSegments
 * Splits the extracted text into up to five segments using a heuristic.
 */
function splitTextIntoSegments(fullText: string): string[] {
  const pageCount = fullText.length / 2500;
  const chapterEstimate = pageCount / 18;
  const numModules = Math.min(Math.round(chapterEstimate) || 1, 5);

  const totalLength = fullText.length;
  const segmentLength = Math.floor(totalLength / numModules);
  const segments: string[] = [];
  console.log("SplitTextIntoSegments Debug:");
  console.log("fullText.length:", totalLength);
  console.log("pageCount (fullText.length / 2500):", pageCount);
  console.log("chapterEstimate (pageCount / 30):", chapterEstimate);
  console.log("numModules (min(round(chapterEstimate) || 1, 5)):", numModules);
  console.log("segmentLength (floor(totalLength / numModules)):", segmentLength);
  console.log(`GenerateLesson.ts issue 12#  The segment length was ${segmentLength}`);
  let start = 0;

  for (let i = 0; i < numModules; i++) {
    const end = start + segmentLength;
    segments.push(fullText.substring(start, end));
    start += segmentLength;
  }
  return segments;
}

/**
 * runMiddleware
 * Wraps middleware execution in a Promise for async/await usage.
 */
function runMiddleware(req: NextApiRequestWithFile, res: NextApiResponse, fn: any): Promise<void> {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: unknown) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve();
    });
  });
}

/**
 * handler
 * Main API handler for lesson generation.
 * SECURITY: Validates session via authenticateRequest before processing.
 */
export default async function handler(req: NextApiRequestWithFile, res: NextApiResponse) {
  try {
    // Only allow POST requests.
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // --- Security Layer: Authenticate the incoming request ---
    const sessionData = await authenticateRequest(req, res);
    if (!sessionData) return; // If authentication fails, the helper handles the response.
    // -------------------------------------------------------------

    // Initialize GridFS bucket if not already initialized.
    await initBucket();

    // Parse the uploaded file using Multer.
    await runMiddleware(req, res, upload.single('file'));

    // Ensure a file was uploaded.
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Step 1: Process the file to determine if PDF conversion is needed.
    const processed = await processFile(req.file.buffer, req.file.mimetype);

    // Step 2: Convert non-PDF files to PDF.
    let finalPDFBuffer: Buffer;
    if (processed.type === 'pdf') {
      finalPDFBuffer = processed.buffer;
    } else {
      finalPDFBuffer = await convertFileToPdf(processed.buffer, processed.type);
    }
    processed.buffer = finalPDFBuffer;
    processed.type = 'pdf';
    processed.contentType = 'application/pdf';

    // Step 3: Store the PDF in GridFS.
    const stored = await storeFile(processed, req.file.originalname, req.file.size);

    // Step 4: Extract text from the file.
    let extractedText: string;
    if (req.file.mimetype === 'text/plain') {
      extractedText = req.file.buffer.toString('utf-8');
    } else {
      const ext = req.file.originalname.split('.').pop()?.toLowerCase();
      const fileExtension = ext ? `.${ext}` : req.file.mimetype;
      extractedText = await extractTextFromFileService(req.file.buffer, fileExtension);
    }

    if (!extractedText.trim()) {
      return res.status(400).json({ error: 'No text could be extracted from the file.' });
    }

    // Step 5: Split the text into segments.
    const textSegments = splitTextIntoSegments(extractedText);
    console.log(`GenerateLesson.ts issue 12# Here are the text segments :  ${textSegments}`);

    // Step 6: Retrieve documentID from the request body.
    const documentID = req.body.fileID;
    const fileId =  uuidv4(); 

    // Step 7: Generate lesson modules concurrently.
    const lessonPromises = textSegments.map(segment => generateLessonFromSegment(segment, documentID, fileId));
    const generatedLessons = await Promise.all(lessonPromises);

    // Step 8: Assemble the final response.
    const responseData = {
      ...stored,
      lessonModules: generatedLessons,
    };

    // Return the unified JSON response.
    res.status(200).json(responseData);
  } catch (error) {
    console.error('GenerateLesson endpoint error:', error);
    res.status(500).json({
      error: 'Error generating lesson',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Export config to disable Next.js automatic body parsing.
 */
export const config = {
  api: {
    bodyParser: false
  }
};
