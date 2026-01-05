/**
 * @file FileUploadService.ts
 * @description
 * Centralized file upload and retrieval service that coordinates permission validation, file
 * processing, Cloudflare R2 object storage, and usage tracking for all upload workflows in
 * the application. This implementation replaces the previous MongoDB GridFS storage layer
 * with an S3-compatible R2 client while preserving the public API contract used by existing
 * Next.js endpoints such as FileAssetsV2 and GenerateLesson. The service continues to enforce
 * Scholar/Educator business rules, subscription tier constraints, file size and type limits,
 * and rate limiting through the UserService integration. All operations include structured
 * logging for observability in production, and the storage layout in R2 encodes owner,
 * visibility, document, and context metadata to support access-control checks at retrieval
 * and deletion time without requiring MongoDB.
 */

import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'; // update - 1
import { convertFileToPdf } from '@/doc-preprocessing-service/gotenberg-service-client';
import { UserService, UserProfile } from '@/app/src/services/userService';

// Step 1: Core interface definitions for service operations
export interface FileUploadRequest {
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  fileSize: number;
  userProfile: UserProfile;
  visibility: 'public' | 'private';
  documentId: string;
  sourceFileId?: string;
  uploadContext?: string; // Optional context identifier (e.g., 'lesson-generation', 'direct-upload')
}

export interface ProcessedFile {
  buffer: Buffer;
  type: 'pdf' | 'docx' | 'txt';
  contentType: string;
  originalMimeType: string;
}

export interface StoredFileResult {
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
    uploadContext?: string;
    document_id: string;
    file_id?: string | null;
  };
}

export interface UploadValidationResult {
  allowed: boolean;
  reason?: string;
  recommendedAction?: string;
}

interface R2AccessCheckResult { // update - 2
  allowed: boolean;
  metadata?: Record<string, string>;
  contentType?: string;
  reason?: string;
}

// Step 2: Supported file types configuration
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
];

/**
 * FileUploadService
 * @description
 * Main service class that provides centralized file upload functionality with comprehensive
 * permission validation, file processing, and storage operations. The service now targets
 * Cloudflare R2 using an S3-compatible client and keeps time complexity for each storage
 * operation at O(1) by always addressing objects directly by key. Metadata written alongside
 * each object encodes ownership and visibility so that access checks can be performed using
 * cheap HEAD requests instead of full content downloads.
 */
export class FileUploadService { // update - 3
  // Step 3: Initialize a single shared R2 client and bucket reference
  private static r2Client: S3Client | null = null; // update - 4
  private static bucketName: string | null = null;  // update - 5

  /**
   * getR2Client
   * @description
   * Lazily initializes and returns the S3Client instance configured for Cloudflare R2 using
   * environment variables. This helper centralizes configuration so that all storage methods
   * share the same client and bucket name. It throws a descriptive error if required
   * environment variables are missing, allowing calling code to fail fast during deployment
   * misconfiguration instead of silently corrupting uploads or access control.
   */
  private static getR2Client(): { client: S3Client; bucket: string } { // update - 6
    if (!this.r2Client) {
      const accountId = process.env.R2_ACCOUNT_ID;
      const accessKeyId = process.env.R2_ACCESS_KEY_ID;
      const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
      const bucket = process.env.R2_BUCKET;

      if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
        console.error('[FileUploadService.ts][3100] Missing R2 environment configuration');
        throw new Error('R2 storage is not configured correctly. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET.');
      }

      this.bucketName = bucket;
      this.r2Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        // ADD THESE TWO LINES (to fix region mismatch error):
        requestChecksumCalculation: 'WHEN_REQUIRED', 
        responseChecksumValidation: 'WHEN_REQUIRED',
      });

      console.log('[FileUploadService.ts][3101] R2 client initialized successfully');
    }

    if (!this.bucketName) {
      throw new Error('R2 bucket name is not initialized.');
    }

    return { client: this.r2Client!, bucket: this.bucketName }; 
  }

  /**
   * validateUploadPermissions
   * @description
   * Comprehensive validation method that checks all upload requirements including account type
   * permissions, subscription tier restrictions, file type validation, size limits, and rate
   * limiting. This method provides detailed feedback for denied requests to improve user experience.
   */
  static async validateUploadPermissions(request: FileUploadRequest): Promise<UploadValidationResult> {
    console.log('[FileUploadService.ts][3004] Validating upload permissions - User:', request.userProfile.email, 'Visibility:', request.visibility, 'Size:', request.fileSize);

    try {
      // Step 4: Validate file type
      if (!ALLOWED_MIME_TYPES.includes(request.mimeType)) {
        console.log('[FileUploadService.ts][3005] Upload denied - unsupported file type:', request.mimeType);
        return {
          allowed: false,
          reason: 'Unsupported file type. Only PDF, TXT, DOC, DOCX, and PPTX files are allowed.',
          recommendedAction: 'Please convert your file to a supported format and try again.'
        };
      }

      //  hard-require documentId
      if (!request.documentId || typeof request.documentId !== 'string' || request.documentId.trim().length === 0) {
        return {
          allowed: false,
          reason: 'Missing required documentId for upload.',
          recommendedAction: 'Please retry the upload from a document context so we can tag it correctly.'
        };
      }

      // Step 5: Validate account type permissions for public uploads
      if (request.visibility === 'public' && request.userProfile.accountType === 'scholar') {
        console.log('[FileUploadService.ts][3006] Upload denied - Scholar cannot create public files');
        return {
          allowed: false,
          reason: 'Scholar accounts can only upload files privately to prevent piracy and protect intellectual property.',
          recommendedAction: 'Change visibility to private or upgrade to Educator account for public upload privileges.'
        };
      }

      // Step 6: Check file size against subscription tier limits
      const maxSizeGB = request.userProfile.limits.maxStorageGB;
      const maxSizeBytes = maxSizeGB * 1024 * 1024 * 1024; // Convert GB to bytes

      if (request.fileSize > maxSizeBytes) {
        console.log('[FileUploadService.ts][3007] Upload denied - file too large for subscription tier');
        return {
          allowed: false,
          reason: `File size exceeds your ${request.userProfile.subscriptionTier} plan limit of ${maxSizeGB}GB per file.`,
          recommendedAction: request.userProfile.subscriptionTier === 'freemium'
            ? 'Upgrade to premium for larger file uploads (100GB limit).'
            : 'Please reduce file size or contact support for enterprise options.'
        };
      }

      // Step 7: Validate upload permissions using existing UserService validation
      const uploadPermissions = await UserService.validateFileUploadPermissions(
        request.userProfile.email,
        request.visibility
      );

      if (!uploadPermissions.allowed) {
        console.log('[FileUploadService.ts][3008] Upload denied by UserService validation:', uploadPermissions.reason);
        return {
          allowed: false,
          reason: uploadPermissions.reason || 'Upload not permitted',
          recommendedAction: uploadPermissions.reason?.includes('rate limit')
            ? 'Please wait before uploading more files or upgrade to premium for higher limits.'
            : 'Please check your account settings or contact support.'
        };
      }

      console.log('[FileUploadService.ts][3009] Upload validation passed successfully');
      return { allowed: true };

    } catch (error) {
      console.error('[FileUploadService.ts][3010] Error during upload validation:', error);
      return {
        allowed: false,
        reason: 'Internal error during validation. Please try again.',
        recommendedAction: 'Please refresh the page and try again. Contact support if the issue persists.'
      };
    }
  }

  /**
   * processFile
   * @description
   * Processes uploaded file buffers based on MIME type with enhanced error handling and logging.
   * This method determines the appropriate conversion strategy and prepares files for storage
   * while maintaining compatibility with the existing document conversion pipeline.
   */
  static async processFile(fileBuffer: Buffer, mimeType: string): Promise<ProcessedFile> {
    console.log('[FileUploadService.ts][3011] Processing file - MIME type:', mimeType, 'Size:', fileBuffer.length);

    try {
      switch (mimeType) {
        case 'application/pdf':
          console.log('[FileUploadService.ts][3012] Processing PDF file - no conversion needed');
          return {
            buffer: fileBuffer,
            type: 'pdf',
            contentType: mimeType,
            originalMimeType: mimeType
          };

        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/vnd.ms-powerpoint':
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        case 'text/plain':
          console.log('[FileUploadService.ts][3013] Processing non-PDF file - conversion required');
          return {
            buffer: fileBuffer,
            type: 'docx', // Mark for conversion; output will be PDF
            contentType: mimeType,
            originalMimeType: mimeType
          };

        default:
          console.error('[FileUploadService.ts][3014] Unsupported file type:', mimeType);
          throw new Error(`Unsupported file type: ${mimeType}`);
      }
    } catch (error) {
      console.error('[FileUploadService.ts][3015] Error processing file:', error);
      throw error;
    }
  }

  /**
   * convertToPDF
   * @description
   * Converts non-PDF files to PDF format using the document conversion service. This method
   * handles the conversion workflow and ensures that all stored files are in PDF format for
   * consistent text extraction and viewing capabilities.
   */
  static async convertToPDF(processed: ProcessedFile): Promise<Buffer> {
    console.log('[FileUploadService.ts][3016] Converting file to PDF - Original type:', processed.originalMimeType);

    try {
      if (processed.type === 'pdf') {
        console.log('[FileUploadService.ts][3017] File already in PDF format, no conversion needed');
        return processed.buffer;
      }

      console.log('[FileUploadService.ts][3018] Starting PDF conversion');
      const pdfBuffer = await convertFileToPdf(processed.buffer, processed.type);
      console.log('[FileUploadService.ts][3019] PDF conversion completed successfully');
      return pdfBuffer;

    } catch (error) {
      console.error('[FileUploadService.ts][3020] PDF conversion failed:', error);
      throw new Error(`Failed to convert file to PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * storeFile
   * @description
   * Stores processed files in Cloudflare R2 using an S3-compatible client and writes rich
   * metadata describing ownership, visibility, account type, and document linkage. 
   * * UPDATE (Phase 1): The R2 object key layout has been changed to `documents/{docId}/files/{fileId}`.
   * This binds the file physically to the document for easier lifecycle management (cascading deletes).
   * The metadata still includes `owner` to support existing permission checks.
   */
  static async storeFile(
    fileBuffer: Buffer,
    fileName: string,
    fileSize: number,
    userProfile: UserProfile,
    visibility: 'public' | 'private',
    originalMimeType: string,
    documentId: string,
    sourceFileId?: string,
    uploadContext?: string
  ): Promise<StoredFileResult> { // update - 7
    console.log('[FileUploadService.ts][3021] Storing file with user context - Owner:', userProfile.email, 'Visibility:', visibility);

    try {
      const { client, bucket } = this.getR2Client(); // update - 8

      // Step 8: Generate unique object key using Document-Centric Storage (Phase 1)
      const timestamp = Date.now(); // update - 9
      const safeFileName = fileName.replace(/\s+/g, '_'); // update - 10
      
      // update - 11: Switch from user-based prefix (`files/${email}`) to document-based prefix.
      // Use sourceFileId if provided (typical for lesson generation), otherwise fallback to timestamp.
      const uniqueFileId = sourceFileId || `${timestamp}_${safeFileName}`;
      const objectKey = `documents/${documentId}/files/${uniqueFileId}`;

      // Step 9: Prepare flat metadata map for S3/R2
      const now = new Date(); // update - 12
      const metadata: Record<string, string> = { // update - 13
        originalname: fileName,
        type: 'pdf',
        size: String(fileSize),
        owner: userProfile.email, // Retained for permission checks
        visibility,
        accounttype: userProfile.accountType,
        subscriptiontier: userProfile.subscriptionTier,
        originalmimetype: originalMimeType,
        uploadedat: now.toISOString(),
        document_id: documentId,
        file_id: sourceFileId ?? '',
        uploadcontext: uploadContext ?? '',
      };

      // Step 10: Upload object to R2
      await client.send(new PutObjectCommand({ // update - 14
        Bucket: bucket,
        Key: objectKey,
        Body: fileBuffer,
        ContentType: 'application/pdf',
        Metadata: metadata,
      }));

      console.log('[FileUploadService.ts][3023] File stored successfully in R2 - Key:', objectKey);

      return {
        id: objectKey,
        url: `/api/FileAssetsV2?id=${encodeURIComponent(objectKey)}`,
        type: 'pdf',
        title: fileName,
        size: fileSize,
        visibility,
        owner: userProfile.email,
        uploadedAt: now,
        metadata: {
          accountType: userProfile.accountType,
          subscriptionTier: userProfile.subscriptionTier,
          originalMimeType,
          document_id: documentId,
          file_id: sourceFileId ?? null,
          uploadContext: uploadContext,
        },
      };

    } catch (error) {
      console.error('[FileUploadService.ts][3024] Error storing file in R2:', error);
      throw new Error(`Failed to store file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * uploadFile
   * @description
   * Main upload method that orchestrates the complete file upload workflow including validation,
   * processing, conversion, storage, and usage tracking. This method provides a single entry point
   * for all file upload operations while ensuring consistent permission enforcement and error handling.
   */
  static async uploadFile(request: FileUploadRequest): Promise<StoredFileResult> {
    console.log('[FileUploadService.ts][3025] Starting complete file upload workflow - User:', request.userProfile.email, 'File:', request.fileName);

    try {
      // Step 12: Validate upload permissions
      const validation = await this.validateUploadPermissions(request);
      if (!validation.allowed) {
        console.log('[FileUploadService.ts][3026] Upload denied:', validation.reason);
        throw new Error(validation.reason || 'Upload not permitted');
      }

      // Step 13: Process the uploaded file
      const processed = await this.processFile(request.fileBuffer, request.mimeType);

      // Step 14: Convert to PDF if necessary
      const finalPDFBuffer = await this.convertToPDF(processed);

      // Step 15: Store file with comprehensive metadata
      const storedFile = await this.storeFile(
        finalPDFBuffer,
        request.fileName,
        request.fileSize,
        request.userProfile,
        request.visibility,
        request.mimeType,
        request.documentId,
        request.sourceFileId,
        request.uploadContext
      );

      // Step 16: Update usage tracking
      await UserService.incrementUsageCounter(request.userProfile.email, 'upload');
      console.log('[FileUploadService.ts][3027] Usage counter incremented for user:', request.userProfile.email);

      console.log('[FileUploadService.ts][3028] File upload completed successfully - ID:', storedFile.id);
      return storedFile;

    } catch (error) {
      console.error('[FileUploadService.ts][3029] File upload failed:', error);
      throw error;
    }
  }

  /**
   * checkFileAccess
   * @description
   * Validates whether a user can access a specific file based on ownership and visibility
   * metadata stored alongside the object in R2. This replaces the previous GridFS lookup
   * and uses a lightweight HEAD request to obtain metadata only, keeping the time complexity
   * of each access check at O(1). Private files require ownership, while public files are
   * readable by any authenticated user.
   */
  static async checkFileAccess(fileId: string, userProfile: UserProfile): Promise<R2AccessCheckResult> { // update - 15
    console.log('[FileUploadService.ts][3030] Checking file access - File ID:', fileId, 'User:', userProfile.email);

    try {
      const { client, bucket } = this.getR2Client(); // update - 16
      const key = fileId; // In the new model, the id is the R2 object key. // update - 17

      const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })); // update - 18
      const metadata = head.Metadata ?? {}; // keys are lowercase // update - 19

      const visibility = (metadata.visibility as 'public' | 'private') || 'private'; // update - 20
      const owner = metadata.owner || metadata.owneremail || ''; // update - 21

      if (visibility === 'private' && owner && owner !== userProfile.email) {
        console.log('[FileUploadService.ts][3032] Access denied - private file not owned by user');
        return {
          allowed: false,
          reason: 'Access denied: This is a private file',
        };
      }

      console.log('[FileUploadService.ts][3033] File access granted');
      return {
        allowed: true,
        metadata: {
          ...metadata,
          contenttype: head.ContentType ?? 'application/pdf',
          owner: owner || userProfile.email,
          visibility,
        },
        contentType: head.ContentType ?? 'application/pdf',
      };

    } catch (error: any) {
      if (error?.$metadata?.httpStatusCode === 404) {
        console.log('[FileUploadService.ts][3031] File not found in R2');
        return {
          allowed: false,
          reason: 'File not found',
        };
      }

      console.error('[FileUploadService.ts][3034] Error checking file access:', error);
      return {
        allowed: false,
        reason: 'Error validating file access',
      };
    }
  }

  /**
   * getFileStream
   * @description
   * Retrieves the binary content stream for a previously uploaded file from Cloudflare R2.
   * The method assumes that access control has already been enforced via checkFileAccess
   * and focuses solely on streaming the object with its content type and metadata. The
   * returned stream can be piped directly to a Next.js API response for efficient, O(1)
   * time complexity downloads.
   */
  static async getFileStream(fileId: string): Promise<{ // update - 22
    stream: NodeJS.ReadableStream;
    contentType: string;
    metadata: Record<string, string>;
  }> {
    const { client, bucket } = this.getR2Client();
    const key = fileId;

    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!result.Body) {
      throw new Error('File content missing from R2 object.');
    }

    const contentType = result.ContentType ?? 'application/octet-stream';
    const metadata = result.Metadata ?? {};

    return {
      stream: result.Body as NodeJS.ReadableStream,
      contentType,
      metadata,
    };
  }

  /**
   * deleteFile
   * @description
   * Securely deletes files stored in R2 with ownership validation to ensure that only the
   * file owner can perform deletion. This method first calls checkFileAccess to reuse the
   * same visibility and ownership logic, and then executes a constant-time DeleteObject
   * operation against Cloudflare R2. Comprehensive logging is retained for auditability
   * and debugging of any deletion-related issues in production.
   */
  static async deleteFile(fileId: string, userProfile: UserProfile): Promise<{
    success: boolean;
    reason?: string;
  }> { // update - 23
    console.log('[FileUploadService.ts][3035] Attempting file deletion - File ID:', fileId, 'User:', userProfile.email);

    try {
      // Step 19: Check access and ownership
      const accessCheck = await this.checkFileAccess(fileId, userProfile);
      if (!accessCheck.allowed) {
        console.log('[FileUploadService.ts][3036] File deletion denied - access check failed');
        return {
          success: false,
          reason: accessCheck.reason || 'Access denied',
        };
      }

      const owner = accessCheck.metadata?.owner;
      if (owner && owner !== userProfile.email) {
        console.log('[FileUploadService.ts][3037] File deletion denied - not owner');
        return {
          success: false,
          reason: 'Only file owners can delete files',
        };
      }

      const { client, bucket } = this.getR2Client();
      const key = fileId;

      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      console.log('[FileUploadService.ts][3038] File deleted successfully from R2');

      return { success: true };

    } catch (error) {
      console.error('[FileUploadService.ts][3039] Error deleting file from R2:', error);
      return {
        success: false,
        reason: 'Error deleting file',
      };
    }
  }
}