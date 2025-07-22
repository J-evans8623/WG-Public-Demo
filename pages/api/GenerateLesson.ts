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
import { generateLessonFromSegment } from '@/app/src/services/TextPreprocessing/LessonModuleServiceV8';
import { authenticateRequest } from '@/app/src/auth/authenticateRequest';
import { v4 as uuidv4 } from 'uuid';
import pdfParse from 'pdf-parse';

/**
 * NextApiRequestWithFile
 * Extends NextApiRequest to include a file property (added by Multer).
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

interface moduleData {
  modules: string[][];
  moduleSize : number;
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
async function storeFile(
  processed: ProcessedFile,
  originalName: string,
  size: number
): Promise<StoredFile> {
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
    size,
  };
}

/**
 * splitTextIntoModules
 * Splits the extracted text array into up to five segments using a heuristic.
 */
function splitTextIntoModules(fullText: string[]): moduleData {
  const pgCount = fullText.length;
  const chapterEstimate = Math.round(pgCount / 30);
  const numModules = Math.min(chapterEstimate || 1, 5);
  const moduleSize = pgCount / numModules;  // for metadata

  console.log('4560-splitTextIntoModules Debug:');
  console.log('  total pages:', pgCount);
  console.log('  chapterEstimate:', chapterEstimate);
  console.log('  numModules:', numModules);
  console.log('  moduleSize:', moduleSize);

  const baseSize = Math.floor(pgCount / numModules);
  const modules: string[][] = [];
  let cursor = 0;

  for (let i = 0; i < numModules; i++) {
    // last module takes any leftover pages
    const end = (i === numModules - 1)
      ? pgCount
      : cursor + baseSize;

    modules.push(fullText.slice(cursor, end));
    cursor = end;
  }

  return {
    modules,
    moduleSize
  };
}


/**
 * runMiddleware
 * Wraps middleware execution in a Promise for async/await usage.
 */
function runMiddleware(
  req: NextApiRequestWithFile,
  res: NextApiResponse,
  fn: any
): Promise<void> {
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
export default async function handler(
  req: NextApiRequestWithFile,
  res: NextApiResponse
) {
  try {
    // Only allow POST requests.
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // --- Security Layer: Authenticate the incoming request ---
    const sessionData = await authenticateRequest(req, res);
    if (!sessionData) return;
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
      console.time(`8640 timer-converting to pdf`)
      finalPDFBuffer = await convertFileToPdf(processed.buffer, processed.type);
      console.timeEnd(`8640 timer-converting to pdf`)
    }
    processed.buffer = finalPDFBuffer;
    processed.type = 'pdf';
    processed.contentType = 'application/pdf';

    // Step 3: Store the PDF in GridFS.
    const stored = await storeFile(processed, req.file.originalname, req.file.size);

    // Step 4: Extract text from the file.
    let extractedTextArray: string[];
    if (req.file.mimetype === 'text/plain') {
      extractedTextArray = [req.file.buffer.toString('utf-8')];
    } else {
      const ext = req.file.originalname.split('.').pop()?.toLowerCase();
      const fileExtension = ext ? `.${ext}` : req.file.mimetype;
      console.time(`8640-extracting text`)  
      extractedTextArray = await extractTextFromFileService(req.file.buffer, fileExtension);
      console.log(`3333 Page marker test ${JSON.stringify(extractedTextArray)}`);
      console.timeEnd(`8640-extracting text`)
    }

    if (extractedTextArray.length == 0) {
      return res.status(400).json({ error: 'No text could be extracted from the file.' });
    }



    // Step 4.5: Count pages & inject page markers
    const pdfData = await pdfParse(finalPDFBuffer);
  
    // Step 5: Split the text into segments, each segment will be turned into a lesson module.
    const textSegments = splitTextIntoModules(extractedTextArray);
    const moduleSize = textSegments.moduleSize;
    console.log(`GenerateLesson.ts issue 12# Here are the text segments :  ${textSegments}`);

    // Step 6: Retrieve documentID and generate a new fileId.
    const documentID = req.body.fileID;
    const fileId = uuidv4();

    // Step 7: Generate lesson modules concurrently.
    const lessonPromises = textSegments.modules.map((segment) =>
      generateLessonFromSegment(extractedTextArray,segment, documentID, fileId, moduleSize)
    );
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
    bodyParser: false,
  },
};
