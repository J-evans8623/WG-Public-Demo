/**
 * @file FileAssets.ts
 * @description
 *   API endpoint for file uploads.
 *   This endpoint accepts a file upload (PDF, DOCX, TXT, PPTX), converts it to a PDF 
 *   via the Document Conversion Service (gotenberg_service), and stores only the final PDF in GridFS.
 * 
 *   In parallel, the original file (if not plain text) is sent to the Text Extraction Microservice.
 *   The extracted text is then passed to LessonModuleServicev1.processDocument to generate lesson modules.
 *
 *   Workflow:
 *     a. User uploads a file (txt, pdf, pptx, docx).
 *     b. The file is converted to a PDF (using gotenberg_service) and saved.
 *     c. The original file is processed via the text extraction service.
 *     d. The output of the text extraction service is fed to processDocument.
 *     e. A combined JSON response with the PDF file details and lesson module summaries is returned.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import multer from 'multer';
import connectDB from '@/app/src/config/db';
import { processDocument, getLessonList } from '@/app/src/services/TextPreprocessing/LessonModuleServicev1';

// Import our conversion and text extraction microservice clients (assumed to be available as HTTP endpoints)
import { convertFileToPdf } from '@/doc-preprocessing-service/gotenberg-service-client'; // Client to call gotenberg_service
import { extractTextFromFileService } from '@/doc-preprocessing-service/text-extraction-client'; // Client to call text extraction microservice

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

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
        files: 1
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF, TXT, DOC, DOCX, and PPTX files are allowed'));
        }
    }
});

/**
 * Processes the uploaded file buffer based on its MIME type.
 * @param file - The uploaded file buffer.
 * @param mimeType - The MIME type of the file.
 * @returns A promise that resolves to a ProcessedFile object.
 */
async function processFile(file: Buffer, mimeType: string): Promise<ProcessedFile> {
    switch(mimeType) {
        case 'application/pdf':
            return {
                buffer: file,
                type: 'pdf',
                contentType: mimeType
            };
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/vnd.ms-powerpoint':
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        case 'text/plain':
            // For non-PDF files, we need to convert them to PDF.
            return {
                buffer: file,
                // We'll mark as 'docx' here for conversion purposes; the conversion service will output a PDF.
                type: 'docx',
                contentType: mimeType
            };
        default:
            throw new Error('Unsupported file type');
    }
}

// Initialize GridFS bucket
let bucket: GridFSBucket;
let isInitialized = false;

/**
 * Initializes the GridFS bucket if not already initialized.
 */
const initBucket = async () => {
    if (isInitialized && bucket) {
        return;
    }
    try {
        await connectDB();
        const db = mongoose.connection.db;
        if (!db) {
            throw new Error('Database connection not established');
        }
        bucket = new mongoose.mongo.GridFSBucket(db, {
            bucketName: 'files'
        });
        isInitialized = true;
    } catch (error) {
        console.error('Failed to initialize GridFS bucket:', error);
        throw error;
    }
};

/**
 * Stores the processed PDF file in GridFS.
 * @param processed - The processed file object.
 * @param originalName - The original file name.
 * @param size - The file size.
 * @returns A promise that resolves to a StoredFile object.
 */
async function storeFile(processed: ProcessedFile, originalName: string, size: number): Promise<StoredFile> {
    const filename = `${Date.now()}-${originalName}`;
    const uploadStream = bucket.openUploadStream(filename, {
        contentType: 'application/pdf', // Always storing PDF files
        metadata: {
            originalName: originalName,
            type: 'pdf',
            size: size
        }
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
        size: size
    };
}

export const config = {
    api: {
        bodyParser: false
    }
};

/**
 * Main API handler for file upload requests.
 * Handles POST (upload), GET (retrieve), and DELETE (remove) methods.
 * For POST requests:
 *  - Converts the uploaded file to PDF (via gotenberg_service).
 *  - Stores the final PDF in GridFS.
 *  - Invokes the text extraction microservice with the original file to extract text.
 *  - Passes the extracted text to processDocument to generate lesson modules.
 *  - Returns a combined JSON response with the stored file details and lesson module summaries.
 * @param req - The API request (which must include a file).
 * @param res - The API response.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        await initBucket();
        switch (req.method) {
            case 'POST':
                await runMiddleware(req, res, upload.single('file'));
                return handleUpload(req, res);
            case 'GET':
                return handleRetrieval(req, res);
            case 'DELETE':
                return handleDeletion(req, res);
            default:
                res.setHeader('Allow', ['POST', 'GET', 'DELETE']);
                res.status(405).end(`Method ${req.method} Not Allowed`);
        }
    } catch (error) {
        console.error('Handler error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Handles the file upload process.
 * This function:
 *   - Converts the uploaded file to PDF via the Document Conversion Service.
 *   - Stores the PDF in GridFS.
 *   - Invokes the Text Extraction Service with the original file if the file is not plain text.
 *   - Passes the extracted text to processDocument, then retrieves generated lesson modules.
 *   - Returns a combined JSON response.
 * @param req - The API request (which must include a file).
 * @param res - The API response.
 */
async function handleUpload(req: NextApiRequest & { file?: Express.Multer.File }, res: NextApiResponse) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      // Step 1: Process the file.
      const processed = await processFile(req.file.buffer, req.file.mimetype);
      
      let finalPDFBuffer: Buffer;
      if (processed.type === 'pdf') {
        // If the file is already a PDF, skip conversion.
        finalPDFBuffer = processed.buffer;
      } else {
        // Otherwise, convert the file to PDF using the Document Conversion Service.
        finalPDFBuffer = await convertFileToPdf(processed.buffer, processed.type);
      }
      
      // Replace processed.buffer with the final PDF.
      processed.buffer = finalPDFBuffer;
      processed.type = 'pdf';
      processed.contentType = 'application/pdf';
      
      // Step 3: Store the final PDF file.
      const stored = await storeFile(processed, req.file.originalname, req.file.size);
      let extraData: any = {};
      
      // Step 4: Extract text.
      let extractedText = "";
      if (req.file.mimetype === 'text/plain') {
        extractedText = req.file.buffer.toString('utf-8');
      } else {
        // Extract file extension from the original file name.
        const ext = req.file.originalname.split('.').pop()?.toLowerCase();
        // Prepend a dot if extension exists; fallback to the MIME type if not.
        const fileExtension = ext ? `.${ext}` : req.file.mimetype;
        
        // Call the text extraction microservice using the file extension.
        extractedText = await extractTextFromFileService(req.file.buffer, fileExtension);
      }
      
      if (extractedText.trim().length > 0) {
        const documentID = req.body.fileID;
        if (!documentID) {
          console.warn("No fileID provided; lesson module processing will not be associated with a document.");
        }
        await processDocument(extractedText, documentID);
        const lessonModules = await getLessonList(documentID);
        extraData.lessonModules = lessonModules;
      }
      
      // Step 5: Return the stored file data combined with extra lesson module data.
      res.status(200).json({ ...stored, ...extraData });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        error: 'Error uploading file',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  

/**
 * Retrieves a file from GridFS.
 * @param req - The API request containing a file ID.
 * @param res - The API response with the file stream.
 */
async function handleRetrieval(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { id } = req.query;
        if (!id || typeof id !== 'string') {
            return res.status(400).json({ error: 'Invalid file ID' });
        }
        const objectId = new mongoose.Types.ObjectId(id);
        const file = await bucket.find({ _id: objectId }).next();
        if (!file) {
            return res.status(404).json({ error: 'File not found' });
        }
        const contentType = file.metadata?.contentType || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        const downloadStream = bucket.openDownloadStream(objectId);
        downloadStream.pipe(res);
    } catch (error) {
        console.error('Retrieval error:', error);
        res.status(500).json({
            error: 'Failed to retrieve file',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Handles file deletion from GridFS.
 * @param req - The API request containing a file ID.
 * @param res - The API response indicating deletion success.
 */
async function handleDeletion(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { id } = req.query;
        if (!id || typeof id !== 'string') {
            return res.status(400).json({ error: 'Invalid file ID' });
        }
        const objectId = new mongoose.Types.ObjectId(id);
        await bucket.delete(objectId);
        res.status(200).json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('Deletion error:', error);
        res.status(500).json({
            error: 'Error deleting file',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Helper to run middleware functions.
 * @param req - The API request.
 * @param res - The API response.
 * @param fn - The middleware function to run.
 * @returns A promise that resolves when middleware processing is complete.
 */
const runMiddleware = (req: NextApiRequest, res: NextApiResponse, fn: any) => {
    return new Promise((resolve, reject) => {
        fn(req, res, (result: any) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
};
