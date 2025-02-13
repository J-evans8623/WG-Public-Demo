// FileAssets.ts
import { NextApiRequest, NextApiResponse } from 'next';
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import multer from 'multer';
import connectDB from '@/app/src/config/db';
import { processDocument } from '@/app/src/services/TextPreprocessing/LessonModuleService';


interface ProcessedFile {
    buffer: Buffer;
    type: 'pdf' | 'docx' | 'txt';
    contentType: string;
}

interface StoredFile {
    id: string;
    url: string;
    type: 'pdf' | 'docx' | 'txt';
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
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF, TXT, DOC, and DOCX files are allowed'));
        }
    }
});

async function processFile(file: Buffer, mimeType: string): Promise<ProcessedFile> {
    switch(mimeType) {
        case 'application/pdf':
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            return {
                buffer: file,
                type: mimeType.includes('pdf') ? 'pdf' : 'docx',
                contentType: mimeType
            };
        case 'text/plain':
            return {
                buffer: file,
                type: 'txt',
                contentType: 'text/plain'
            };
        default:
            throw new Error('Unsupported file type');
    }
}

// Initialize GridFS bucket
let bucket: GridFSBucket;
let isInitialized = false;

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

async function storeFile(processed: ProcessedFile, originalName: string, size: number): Promise<StoredFile> {
    const filename = `${Date.now()}-${originalName}`;
    
    const uploadStream = bucket.openUploadStream(filename, {
        contentType: processed.contentType,
        metadata: {
            originalName: originalName,
            type: processed.type,
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
        url: `/api/FileAssets?id=${uploadStream.id}`,  // `/api/FileAssets?id=${uploadStream.id}`
        type: processed.type,
        title: originalName,
        size: size
    };
}

export const config = {
    api: {
        bodyParser: false
    }
};

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

async function extractTextFromFile(buffer: Buffer, mimeType: string): Promise<string> {
    if (mimeType === 'text/plain') {
      return buffer.toString('utf-8');
    }
    // Placeholder: For PDFs and DOCX, return an empty string or implement extraction.
    console.warn(`Text extraction for MIME type ${mimeType} is not implemented yet.`);
    return '';
  }
  
async function handleUpload(req: NextApiRequest & { file?: Express.Multer.File }, res: NextApiResponse) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const processed = await processFile(req.file.buffer, req.file.mimetype);
        const stored = await storeFile(processed, req.file.originalname, req.file.size);

        if (req.file.mimetype === 'text/plain') {
            const extractedText = await extractTextFromFile(req.file.buffer, req.file.mimetype);
            if (extractedText.trim().length > 0) {
              // Fire-and-forget the document processing (so as not to delay the upload response).

              const documentID = req.body.fileID;
              console.log('FileAsset.ts is Invoking handleUpload.... with file id', documentID);
              if (!documentID) {
                console.warn("No fileID provided in form data; lesson module processing will not be associated with a document.");
              }
              setImmediate(() => {
                processDocument(extractedText, documentID).catch(err => {
                  console.error("Error processing lesson modules:", err);
                });
              });
            }
          } else {
            console.log(`Skipping lesson module processing for MIME type: ${req.file.mimetype}`);
          }

        res.status(200).json(stored);
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            error: 'Error uploading file',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

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

        // Check if contentType exists in file metadata or use a default
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