// asset.ts
import { NextApiRequest, NextApiResponse } from 'next';
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import multer from 'multer';
import sharp from 'sharp';
import connectDB from '@/app/src/config/db';

interface ProcessedImage {
    id: string;
    url: string;
    size: number;
    format: string;
}

// Configure multer with stricter limits and validation
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 1 // Only allow 1 file per request
    },
    fileFilter: (req, file, cb) => {
        // Only allow images
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Enhanced middleware runner with better error handling
const runMiddleware = (req: NextApiRequest, res: NextApiResponse, fn: any) => {
    return new Promise((resolve, reject) => {
        fn(req, res, (result: any) => {
            if (result instanceof Error) {
                console.error('Middleware error:', result);
                return reject(result);
            }
            return resolve(result);
        });
    });
};

// Global bucket with initialization check
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
            bucketName: 'images',
            chunkSizeBytes: 255 * 1024 // 255KB chunks
        });

        isInitialized = true;
        console.log('GridFS bucket initialized successfully');
    } catch (error) {
        console.error('Failed to initialize GridFS bucket:', error);
        throw error;
    }
};

export const config = {
    api: {
        bodyParser: false
    }
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        await initBucket();

        switch (req.method) {
            case 'POST':
                await runMiddleware(req, res, upload.single('image'));
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

async function handleUpload(req: NextApiRequest & { file?: Express.Multer.File }, res: NextApiResponse) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log('Processing upload for file:', req.file.originalname);
        const processedImage = await processAndStoreImage(req);
        console.log('Upload successful:', processedImage);

        res.status(200).json(processedImage);
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

        console.log('Attempting to retrieve file:', id);

        const objectId = new mongoose.Types.ObjectId(id);
        const downloadStream = bucket.openDownloadStream(objectId);

        // Set appropriate headers
        res.setHeader('Content-Type', 'image/*');
        res.setHeader('Cache-Control', 'public, max-age=31536000');

        // Handle stream events
        downloadStream.on('error', (error) => {
            console.error('Download stream error:', error);
            if (!res.headersSent) {
                res.status(404).json({ error: 'File not found' });
            }
        });

        downloadStream.pipe(res);
    } catch (error) {
        console.error('Retrieval error:', error);
        if (!res.headersSent) {
            res.status(404).json({ 
                error: 'File not found',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
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

async function processAndStoreImage(req: NextApiRequest & { file?: Express.Multer.File }): Promise<ProcessedImage> {
    if (!req.file) {
        throw new Error('No file to process');
    }

    try {
        // Process image with sharp
        const optimizedBuffer = await sharp(req.file.buffer)
            .resize(2000, 2000, { 
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ 
                quality: 80,
                progressive: true
            })
            .toBuffer();

        // Generate a unique filename
        const filename = `${Date.now()}-${req.file.originalname}`;
        
        // Create upload stream
        const uploadStream = bucket.openUploadStream(filename, {
            contentType: req.file.mimetype,
            metadata: {
                originalName: req.file.originalname,
                size: optimizedBuffer.length,
                uploadDate: new Date()
            }
        });

        // Handle upload with proper error handling
        await new Promise<void>((resolve, reject) => {
            uploadStream.on('error', (error) => {
                console.error('Upload stream error:', error);
                reject(error);
            });

            uploadStream.on('finish', () => {
                console.log('Upload completed with ID:', uploadStream.id);
                resolve();
            });

            uploadStream.end(optimizedBuffer);
        });

        return {
            id: uploadStream.id.toString(),
            url: `/api/asset?id=${uploadStream.id}`,
            size: optimizedBuffer.length,
            format: req.file.mimetype
        };
    } catch (error) {
        console.error('Image processing error:', error);
        throw error;
    }
}