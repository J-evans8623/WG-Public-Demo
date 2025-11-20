// pages/api/FileAssetsV2.ts

/**
 * @file FileAssetsV2.ts (Refactored for R2 Storage)
 * @description
 *   Refactored API endpoint for file uploads that still leverages the centralized FileUploadService
 *   for all upload operations while now streaming file content from Cloudflare R2 instead of MongoDB
 *   GridFS. The endpoint preserves the existing API contract, authentication behaviour via
 *   authenticateRequest, and error response shapes so that existing client components remain fully
 *   compatible. Uploads continue to support Scholar/Educator account validation, freemium/premium
 *   subscription restrictions, and public/private visibility controls. Text extraction and embedding
 *   persistence are unchanged and still executed after a successful upload. Retrieval and deletion
 *   handlers have been updated to delegate storage access to FileUploadService, which in turn talks
 *   to R2, ensuring a single storage backend for both direct uploads and lesson generation workflows.
 */

import { NextApiRequest, NextApiResponse } from 'next';
import multer from 'multer';
import { persistLessonContext } from '@/app/src/services/TextPreprocessing/persistLessonContext';
import { extractTextFromFileService } from '@/doc-preprocessing-service/text-extraction-client';
import { authenticateRequest, EnhancedSession } from '@/app/src/auth/authenticateRequest';
import { FileUploadService, FileUploadRequest } from '@/app/src/services/FileUploadService';
import { UserService } from '@/app/src/services/userService';

// Step 1: Preserve existing interfaces for API compatibility
interface StoredFile {
  id: string;
  url: string;
  type: 'pdf';
  title: string;
  size: number;
  visibility: 'public' | 'private';
  owner: string;
  uploadedAt: Date;
  metadata: {
    accountType: string;
    subscriptionTier: string;
    originalMimeType: string;
  };
}

// Step 2: Configure multer with existing validation rules
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB base limit
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    console.log('[FileAssetsV2.ts][4001] Validating file type:', file.mimetype);

    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      console.log('[FileAssetsV2.ts][4002] File type validation passed');
      cb(null, true);
    } else {
      console.log('[FileAssetsV2.ts][4003] File type validation failed - unsupported type');
      cb(new Error('Only PDF, TXT, DOC, DOCX, and PPTX files are allowed'));
    }
  },
});

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * handler
 * @description
 * Main API handler that processes file upload requests using the centralized FileUploadService
 * while maintaining existing API contracts and response formats. This refactored handler eliminates
 * duplicated upload logic while preserving all existing functionality including text extraction,
 * lesson module integration, and comprehensive error handling.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log('[FileAssetsV2.ts][4004] Handling request - Method:', req.method);

    // Step 3: Authenticate and validate user session (required for all methods) // update - 1
    const sessionData = await authenticateRequest(req, res);
    if (!sessionData) {
      console.log('[FileAssetsV2.ts][4005] Authentication failed');
      return; // Authentication helper sends error response
    }

    switch (req.method) {
      case 'POST':
        await runMiddleware(req, res, upload.single('file'));
        return handleUploadWithService(req, res, sessionData);
      case 'GET':
        return handleSecureRetrieval(req, res, sessionData);
      case 'DELETE':
        return handleSecureDeletion(req, res, sessionData);
      default:
        res.setHeader('Allow', ['POST', 'GET', 'DELETE']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }

  } catch (error) {
    console.error('[FileAssetsV2.ts][4006] Handler error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'HANDLER_ERROR',
    });
  }
}

/**
 * handleUploadWithService
 * @description
 * Refactored upload handler that uses the centralized FileUploadService for all upload operations
 * while maintaining existing API response formats and text extraction capabilities. This method
 * eliminates code duplication while preserving backward compatibility and existing functionality.
 */
async function handleUploadWithService(
  req: NextApiRequest & { file?: Express.Multer.File },
  res: NextApiResponse,
  session: EnhancedSession
) {
  try {
    console.log('[FileAssetsV2.ts][4007] Starting upload with centralized service');

    // Step 4: Validate file presence
    if (!req.file) {
      console.log('[FileAssetsV2.ts][4008] Upload failed - no file provided');
      return res.status(400).json({
        error: 'No file uploaded',
        code: 'NO_FILE',
        userGuidance: 'Please select a file to upload',
      });
    }

    // Step 4.1: Validate documentId is present (forward-only contract)
    const documentId = typeof req.body?.DocID === 'string' ? req.body.DocID.trim() : ''; // update - 2
    const sourceFileId = typeof req.body?.fileID === 'string' ? req.body.fileID.trim() : undefined; // update - 3
    if (!documentId) {
      console.log('[FileAssetsV2.ts][4010a] Missing DocID in upload form-data');
      return res.status(400).json({
        error: 'Missing required DocID',
        code: 'MISSING_DOCID',
        userGuidance: 'Please retry the upload from within a document so we can tag it correctly.',
      });
    }

    // Step 5: Extract visibility preference and user profile
    const requestedVisibility = (req.body.visibility as 'public' | 'private') || 'private';

    const userProfile = await UserService.getUserProfile(session.user.email);

    console.log('[FileAssetsV2.ts][4009] Upload request - File:', req.file.originalname, 'Visibility:', requestedVisibility, 'User:', userProfile.email);

    // Step 6: Create upload request for centralized service
    const uploadRequest: FileUploadRequest = {
      fileBuffer: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      userProfile: userProfile,
      visibility: requestedVisibility,
      documentId,
      sourceFileId,
      uploadContext: 'direct-upload',
    };

    // Step 7: Execute upload through centralized service
    console.log('[FileAssetsV2.ts][4010] Delegating upload to FileUploadService');
    const uploadResult = await FileUploadService.uploadFile(uploadRequest);
    console.log('[FileAssetsV2.ts][4011] Upload completed via service - File ID:', uploadResult.id);

    // Step 8: Perform text extraction for lesson module generation
    let extractedText = '';
    const extraData: any = {};

    try {
      if (req.file.mimetype === 'text/plain') {
        extractedText = req.file.buffer.toString('utf-8');
        console.log('[FileAssetsV2.ts][4012] Extracted text from plain text file');
      } else {
        const ext = req.file.originalname.split('.').pop()?.toLowerCase();
        const fileExtension = ext ? `.${ext}` : req.file.mimetype;
        const extractedArray = await extractTextFromFileService(req.file.buffer, fileExtension);
        extractedText = extractedArray.join(' ');
        console.log('[FileAssetsV2.ts][4013] Extracted text from document file');
      }

      // Step 9: Persist text embeddings if content exists
      if (extractedText.trim().length > 0) {
        const documentID = req.body.DocID;
        const fileID = req.body.fileID;

        await persistLessonContext(extractedText, documentID, fileID);
        console.log('[FileAssetsV2.ts][4014] Text embeddings persisted successfully');

        extraData.textExtracted = true;
        extraData.textLength = extractedText.length;
      }

    } catch (textError) {
      console.error('[FileAssetsV2.ts][4015] Text extraction failed (non-critical):', textError);
      extraData.textExtracted = false;
      extraData.textError = 'Text extraction failed but file upload succeeded';
    }

    // Step 10: Format response to maintain API compatibility
    const response = {
      id: uploadResult.id,
      url: uploadResult.url,
      type: uploadResult.type,
      title: uploadResult.title,
      size: uploadResult.size,
      visibility: uploadResult.visibility,
      owner: uploadResult.owner,
      uploadedAt: uploadResult.uploadedAt,
      metadata: uploadResult.metadata,
      ...extraData,
      userContext: {
        accountType: userProfile.accountType,
        subscriptionTier: userProfile.subscriptionTier,
        remainingUploads:
          userProfile.subscriptionTier === 'freemium'
            ? 'Limited daily uploads'
            : 'Generous upload limits',
        canCreatePublicFiles: userProfile.features.canCreatePublicFiles,
      },
      uploadSuccess: true,
    };

    console.log('[FileAssetsV2.ts][4016] Upload response prepared with backward compatibility');
    res.status(200).json(response);

  } catch (error) {
    console.error('[FileAssetsV2.ts][4017] Upload error:', error);

    // Step 11: Handle service errors with appropriate user feedback
    if (error instanceof Error) {
      if (
        error.message.includes('Upload not permitted') ||
        error.message.includes('rate limit') ||
        error.message.includes('cannot create public files')
      ) {
        return res.status(403).json({
          error: error.message,
          code: 'UPLOAD_DENIED',
          userGuidance: 'Please check your account permissions or upgrade your subscription.',
        });
      }
    }

    res.status(500).json({
      error: 'Error uploading file',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'UPLOAD_ERROR',
      userGuidance: 'Please try again. If the problem persists, contact support.',
    });
  }
}

/**
 * handleSecureRetrieval
 * @description
 * Secure file retrieval handler that uses the centralized FileUploadService for access control
 * validation while maintaining existing response patterns and error handling. The file content
 * is streamed directly from Cloudflare R2 using a read stream, preserving O(1) access time.
 */
async function handleSecureRetrieval(
  req: NextApiRequest,
  res: NextApiResponse,
  session: EnhancedSession
) { // update - 4
  try {
    console.log('[FileAssetsV2.ts][4018] Starting secure file retrieval');

    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        error: 'Invalid file ID',
        code: 'INVALID_FILE_ID',
      });
    }

    const decodedId = decodeURIComponent(id); // update - 5

    const userProfile = await UserService.getUserProfile(session.user.email);

    // Step 12: Use centralized service for access validation
    const accessCheck = await FileUploadService.checkFileAccess(decodedId, userProfile); // update - 6

    if (!accessCheck.allowed) {
      console.log('[FileAssetsV2.ts][4019] File access denied:', accessCheck.reason);
      return res.status(403).json({
        error: accessCheck.reason,
        code: 'ACCESS_DENIED',
      });
    }

    // Step 13: Stream the file using R2 operations via FileUploadService
    const { stream, contentType, metadata } = await FileUploadService.getFileStream(decodedId); // update - 7

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-File-Owner', metadata.owner || 'unknown');
    res.setHeader('X-File-Visibility', metadata.visibility || 'unknown');

    stream.on('error', (error: any) => {
      console.error('[FileAssetsV2.ts][4020] Download stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming file' });
      }
    });

    console.log('[FileAssetsV2.ts][4021] Streaming file to client');
    stream.pipe(res);

  } catch (error) {
    console.error('[FileAssetsV2.ts][4022] Secure retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve file',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'RETRIEVAL_ERROR',
    });
  }
}

/**
 * handleSecureDeletion
 * @description
 * Secure file deletion handler that uses the centralized FileUploadService for ownership
 * validation and deletion operations while maintaining existing response formats.
 */
async function handleSecureDeletion(
  req: NextApiRequest,
  res: NextApiResponse,
  session: EnhancedSession
) {
  try {
    console.log('[FileAssetsV2.ts][4023] Starting secure file deletion');

    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        error: 'Invalid file ID',
        code: 'INVALID_FILE_ID',
      });
    }

    const decodedId = decodeURIComponent(id); // update - 8

    const userProfile = await UserService.getUserProfile(session.user.email);

    // Step 14: Use centralized service for deletion with ownership validation
    const deletionResult = await FileUploadService.deleteFile(decodedId, userProfile); // update - 9

    if (!deletionResult.success) {
      console.log('[FileAssetsV2.ts][4024] File deletion denied:', deletionResult.reason);
      return res.status(403).json({
        error: deletionResult.reason,
        code: 'DELETE_DENIED',
      });
    }

    console.log('[FileAssetsV2.ts][4025] File deleted successfully');
    res.status(200).json({
      message: 'File deleted successfully',
      deletedBy: userProfile.email,
      deletedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[FileAssetsV2.ts][4026] Secure deletion error:', error);
    res.status(500).json({
      error: 'Error deleting file',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'DELETION_ERROR',
    });
  }
}

/**
 * runMiddleware
 * @description
 * Helper function to run Express middleware in Next.js API routes with proper error handling
 * and promise-based interface. This function enables the use of multer for file uploads.
 */
const runMiddleware = (req: NextApiRequest, res: NextApiResponse, fn: any): Promise<any> => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        console.error('[FileAssetsV2.ts][4027] Middleware error:', result);
        return reject(result);
      }
      console.log('[FileAssetsV2.ts][4028] Middleware executed successfully');
      return resolve(result);
    });
  });
};
