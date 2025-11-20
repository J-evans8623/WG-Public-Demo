/**
 * @file asset.ts
 * @description
 * API endpoint for processing image assets using Cloudflare R2 as the backing storage layer
 * instead of MongoDB GridFS. This endpoint supports authenticated image uploads, retrieval,
 * and deletion while preserving the existing HTTP contract, including the `ProcessedImage`
 * response shape, URL format, and rate-limiting behaviour. All requests are first passed
 * through `authenticateRequest` to ensure only signed-in sessions can interact with the
 * endpoint, and `withRateLimitNP('np:asset')` wraps the handler to enforce per-user usage
 * limits. Uploaded images are processed through Sharp to generate optimized JPEG buffers,
 * which are then stored in R2 under a deterministic `images/{timestamp}_{filename}` key.
 * That key is returned as the asset `id` and is used for direct O(1) retrieval and
 * deletion operations, without introducing new ownership checks beyond authentication.
 * * UPDATE (Phase 2):
 * - Reads `DocID` from the request body.
 * - If `DocID` is present, stores image at `documents/{docId}/images/...`.
 * - Adds `document_id` and `uploadcontext` to R2 object metadata.
 *
 * Responsibilities:
 * 1) Authenticate all incoming asset requests via `authenticateRequest` to enforce session-based access.
 * 2) Apply non-premium rate limiting with `withRateLimitNP('np:asset')` to protect service capacity.
 * 3) Accept a single `image/*` file per upload request, constrained to 5MB, using Multer in memory.
 * 4) Process uploads with Sharp to resize and compress images into efficient JPEG assets.
 * 5) Store optimized images in Cloudflare R2 using an S3-compatible `S3Client` and deterministic keys.
 * 6) Provide O(1) retrieval by streaming R2 objects directly to the client using `GetObjectCommand`.
 * 7) Support deletion via `DeleteObjectCommand` for any authenticated caller who knows the asset id.
 * 8) Maintain full backward compatibility with the previous JSON shape and URL patterns for assets.
 */

import { NextApiRequest, NextApiResponse } from 'next'; // update - 1
import multer from 'multer'; // update - 2
import sharp from 'sharp'; // update - 3
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'; // update - 4
import { authenticateRequest } from '@/app/src/auth/authenticateRequest'; // update - 5
import { withRateLimitNP } from '@/app/src/services/rate-np/withRateLimitNP'; // update - 6

interface ProcessedImage {
  id: string;
  url: string;
  size: number;
  format: string;
}

// Step 1: Configure multer with stricter limits and validation (unchanged semantics).
const upload = multer({ // update - 7
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1, // Only allow 1 file per request
  },
  fileFilter: (req, file, cb) => {
    // Only allow images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Step 2: Helper type for requests enhanced with Multer.
interface NextApiRequestWithFile extends NextApiRequest { // update - 8
  file?: Express.Multer.File;
}

/**
 * runMiddleware
 * @description
 * Utility wrapper that adapts callback-based Express middleware, such as Multer, to a
 * Promise-based interface suitable for async/await usage in Next.js API routes. This
 * function ensures that middleware errors are logged, properly propagated as rejections,
 * and do not silently fail, enabling predictable control flow around upload operations.
 * Time complexity is O(1) with respect to request data, as it simply delegates to the
 * underlying middleware and resolves once that middleware has completed execution.
 */
const runMiddleware = ( // update - 9
  req: NextApiRequestWithFile,
  res: NextApiResponse,
  fn: any
): Promise<void> => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        console.error('[asset.ts][3001] Middleware error:', result);
        return reject(result);
      }
      return resolve();
    });
  });
};

// Step 3: R2 client and bucket cache for all operations in this module.
let r2Client: S3Client | null = null; // update - 10
let r2BucketName: string | null = null; // update - 11

/**
 * getR2Client
 * @description
 * Lazily initializes and returns a configured Cloudflare R2 S3 client and bucket name
 * using environment variables. This helper guarantees that all asset operations share
 * a single client instance for optimal performance while failing fast with a descriptive
 * error message when configuration is missing. Time complexity is O(1) on subsequent
 * calls after initialization, since the client and bucket name are cached in module
 * scope and reused for all Put/Get/Delete commands triggered by asset operations.
 */
function getR2Client(): { client: S3Client; bucket: string } { // update - 12
  if (!r2Client) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      console.error(
        '[asset.ts][3002] Missing R2 configuration: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, or R2_BUCKET not set'
      );
      throw new Error(
        'R2 storage is not configured correctly. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET.'
      );
    }

    r2BucketName = bucket;
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    console.log('[asset.ts][3003] R2 client initialized successfully for image assets');
  }

  if (!r2BucketName) {
    throw new Error('[asset.ts][3004] R2 bucket name not initialized');
  }

  return { client: r2Client, bucket: r2BucketName };
}

export const config = { // update - 13
  api: {
    bodyParser: false,
  },
};

/**
 * handler
 * @description
 * Main API handler for image asset operations that first authenticates the request via
 * `authenticateRequest`, then routes to the appropriate method-specific handler based
 * on the HTTP verb. The function keeps the public interface identical to the previous
 * GridFS-backed implementation, while internally delegating all storage operations to
 * Cloudflare R2. Every request is wrapped by a non-premium rate limiter to guard
 * against abuse, and time complexity for routing is O(1).
 */
async function handler( // update - 14
  req: NextApiRequestWithFile,
  res: NextApiResponse
) {
  try {
    console.log('[asset.ts][3005] Handling asset request - Method:', req.method);

    // Step 1: Authenticate the incoming request.
    const sessionData = await authenticateRequest(req, res);
    if (!sessionData) {
      console.log('[asset.ts][3006] Authentication failed for asset request');
      return; // authenticateRequest already handled the response
    }

    // Route based on HTTP method.
    switch (req.method) {
      case 'POST':
        // Multer processes body; req.body will be populated with text fields after this await
        await runMiddleware(req, res, upload.single('image'));
        return handleUpload(req, res, sessionData);
      case 'GET':
        return handleRetrieval(req, res);
      case 'DELETE':
        return handleDeletion(req, res);
      default:
        res.setHeader('Allow', ['POST', 'GET', 'DELETE']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('[asset.ts][3007] Handler error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * handleUpload
 * @description
 * Handles authenticated POST requests to upload a single image file. This function assumes
 * Multer has already populated `req.file` and then delegates to `processAndStoreImage` to
 * perform Sharp-based optimization and R2 storage. On success, it returns a `ProcessedImage`
 * JSON payload identical in shape to the previous GridFS-powered implementation, with `id`
 * representing the R2 object key and `url` pointing back to `/api/asset?id={id}`.
 */
async function handleUpload( // update - 15
  req: NextApiRequestWithFile,
  res: NextApiResponse,
  session: any // Pass session to get owner email if needed
) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('[asset.ts][3008] Processing upload for file:', req.file.originalname);
    // Pass session user email to store as owner in metadata
    const processedImage = await processAndStoreImage(req, session.user.email);
    console.log('[asset.ts][3009] Upload successful:', processedImage);

    res.status(200).json(processedImage);
  } catch (error) {
    console.error('[asset.ts][3010] Upload error:', error);
    res.status(500).json({
      error: 'Error uploading file',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * handleRetrieval
 * @description
 * Handles authenticated GET requests to retrieve an image asset by its `id` query parameter.
 * The function decodes the identifier, reads the corresponding object from Cloudflare R2
 * using `GetObjectCommand`, and streams the binary content directly to the HTTP response.
 * If the object is missing or an error occurs, the function returns a 404 response while
 * maintaining the previous behaviour of using generic `image/*` content type as a fallback.
 */
async function handleRetrieval( // update - 16
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const decodedId = decodeURIComponent(id);
    console.log('[asset.ts][3011] Attempting to retrieve file:', decodedId);

    const { client, bucket } = getR2Client();
    const result = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: decodedId,
      })
    );

    if (!result.Body) {
      console.error('[asset.ts][3012] R2 object missing body for key:', decodedId);
      return res.status(404).json({ error: 'File not found' });
    }

    // Set appropriate headers
    const contentType = result.ContentType || 'image/*';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');

    const stream = result.Body as NodeJS.ReadableStream;

    stream.on('error', (error: any) => {
      console.error('[asset.ts][3013] Download stream error:', error);
      if (!res.headersSent) {
        res.status(404).json({ error: 'File not found' });
      }
    });

    console.log('[asset.ts][3014] Streaming file to client from R2');
    stream.pipe(res);
  } catch (error) {
    console.error('[asset.ts][3015] Retrieval error:', error);
    if (!res.headersSent) {
      res.status(404).json({
        error: 'File not found',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

/**
 * handleDeletion
 * @description
 * Handles authenticated DELETE requests to remove an image asset from storage. The function
 * decodes the `id` query parameter and issues a `DeleteObjectCommand` against Cloudflare R2
 * using that key. Behaviour intentionally mirrors the original GridFS implementation by not
 * introducing additional ownership checks: any authenticated caller who knows a valid `id`
 * can delete the image. Deletion is effectively idempotent, returning success even if the
 * object already does not exist in R2.
 */
async function handleDeletion( // update - 17
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid file ID' });
    }

    const decodedId = decodeURIComponent(id);
    console.log('[asset.ts][3016] Attempting to delete file:', decodedId);

    const { client, bucket } = getR2Client();

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: decodedId,
      })
    );

    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('[asset.ts][3017] Deletion error:', error);
    res.status(500).json({
      error: 'Error deleting file',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * processAndStoreImage
 * @description
 * Processes an uploaded image using Sharp and stores the optimized buffer in Cloudflare R2.
 * The image is resized to fit within a 2000x2000 pixel box without enlargement and saved
 * with JPEG compression for efficient transfer. 
 * * UPDATE (Phase 2): 
 * - Checks `req.body.DocID` for a document context.
 * - If present, stores at `documents/{docId}/images/...` for proper lifecycle scoping.
 * - Fallback to global `images/` path if no DocID provided.
 * - Writes `document_id` and `owner` to R2 metadata.
 */
async function processAndStoreImage( // update - 18
  req: NextApiRequestWithFile,
  ownerEmail: string
): Promise<ProcessedImage> {
  if (!req.file) {
    throw new Error('No file to process');
  }

  try {
    const { client, bucket } = getR2Client();

    // Step 4: Process image with sharp
    const optimizedBuffer = await sharp(req.file.buffer)
      .resize(2000, 2000, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 80,
        progressive: true,
      })
      .toBuffer();

    // Step 5: Generate unique key
    const timestamp = Date.now();
    const safeOriginalName = req.file.originalname.replace(/\s+/g, '_');
    
    // update - 19: Extract DocID from body (parsed by Multer) and determine prefix
    const documentId = 
      typeof (req.body as any)?.DocID === 'string' 
        ? (req.body as any).DocID.trim() 
        : '';

    // If DocID exists, use doc-scoped path; otherwise fallback to global 'images/'
    const basePrefix = documentId 
      ? `documents/${documentId}/images/` 
      : 'images/';

    const objectKey = `${basePrefix}${timestamp}-${safeOriginalName}`;

    console.log('[asset.ts][3020] Storing image', { 
      objectKey, 
      documentId: documentId || 'global',
      owner: ownerEmail
    });

    // Step 6: Upload object to R2 with enhanced metadata
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: optimizedBuffer,
        ContentType: req.file.mimetype,
        Metadata: {
          originalname: req.file.originalname,
          size: String(optimizedBuffer.length),
          uploaddate: new Date().toISOString(),
          // update - 20: Add document and owner metadata
          document_id: documentId,
          owner: ownerEmail, 
          uploadcontext: 'editor-image',
        },
      })
    );

    return {
      id: objectKey,
      url: `/api/asset?id=${encodeURIComponent(objectKey)}`,
      size: optimizedBuffer.length,
      format: req.file.mimetype,
    };
  } catch (error) {
    console.error('[asset.ts][3019] Image processing or storage error:', error);
    throw error;
  }
}

// Step 7: Wrap handler with NP rate limiting for all asset operations.
export default withRateLimitNP('np:asset')(handler);