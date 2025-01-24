// pages/api/asset/[...handler].ts

/**
 * Asset Server API Handler
 * Handles image upload, processing, and retrieval requests
 * Supports storing images in MongoDB GridFS
 */

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

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Initialize GridFS bucket
let bucket: GridFSBucket;

const initBucket = async () => {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established');
  }
  bucket = new mongoose.mongo.GridFSBucket(db);
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
  await initBucket();

  switch (req.method) {
    case 'POST':
      return handleUpload(req, res);
    case 'GET':
      return handleRetrieval(req, res);
    default:
      res.setHeader('Allow', ['POST', 'GET']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

async function handleUpload(req: NextApiRequest, res: NextApiResponse) {
  try {
    const processedImage = await processAndStoreImage(req);
    res.status(200).json(processedImage);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Error uploading file' });
  }
}

async function handleRetrieval(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id } = req.query;
    const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(id as string));
    res.setHeader('Content-Type', 'image/*');
    downloadStream.pipe(res);
  } catch (error) {
    console.error('Retrieval error:', error);
    res.status(404).json({ error: 'File not found' });
  }
}

async function processAndStoreImage(req: any): Promise<ProcessedImage> {
  const file = req.file;
  const optimizedBuffer = await sharp(file.buffer)
    .resize(2000, 2000, { fit: 'inside' })
    .toBuffer();

  const uploadStream = bucket.openUploadStream(file.originalname);
  await new Promise<void>((resolve, reject) => {
    // First add error handler
    uploadStream.on('error', (error) => {
      reject(error);
    });

    // Then add finish handler
    uploadStream.on('finish', () => {
      resolve();
    });

    // Write the buffer
    uploadStream.end(optimizedBuffer);
  });

  return {
    id: uploadStream.id.toString(),
    url: `/api/asset/${uploadStream.id}`,
    size: optimizedBuffer.length,
    format: file.mimetype
  };
}