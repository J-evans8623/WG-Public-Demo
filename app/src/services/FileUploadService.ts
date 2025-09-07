/**
 * @file FileUploadService.ts
 * @description
 *   Centralized file upload service that provides comprehensive file upload functionality including
 *   permission validation, file processing, GridFS storage, and usage tracking. This service ensures
 *   consistent enforcement of account-based permissions and subscription tier restrictions across all
 *   upload workflows in the application. The service abstracts all upload complexity from individual
 *   endpoints, providing a unified interface for both direct file uploads and lesson generation workflows.
 *   It handles Scholar/Educator account type validation, freemium/premium subscription tier checking,
 *   public/private visibility controls, file type validation, size restrictions, rate limiting, and
 *   comprehensive error handling. The service integrates seamlessly with the existing UserService for
 *   permission validation and usage tracking while maintaining optimal performance through efficient
 *   file processing and storage operations. All operations include detailed logging for debugging and
 *   observability, ensuring production-ready reliability and maintainability.
 *
 * Responsibilities:
 *   - Validate user permissions based on account type and subscription tier
 *   - Enforce file upload restrictions and visibility controls
 *   - Process uploaded files and convert to PDF format when necessary
 *   - Store files securely in GridFS with proper metadata and access control
 *   - Track usage metrics and enforce rate limiting
 *   - Provide comprehensive error handling with detailed user feedback
 *   - Maintain integration with existing authentication and user management systems
 *
 * @author System
 * @date Current
 */

import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import connectDB from '@/app/src/config/db';
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
  };
}

export interface UploadValidationResult {
  allowed: boolean;
  reason?: string;
  recommendedAction?: string;
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

// Step 3: GridFS bucket management with singleton pattern
class GridFSManager {
  private static instance: GridFSManager;
  private bucket: GridFSBucket | null = null;
  private isInitialized = false;

  private constructor() {}

  /**
   * getInstance
   * @description
   * Singleton pattern implementation to ensure only one GridFS manager instance exists.
   * This prevents multiple bucket initializations and ensures consistent file storage operations.
   */
  static getInstance(): GridFSManager {
    if (!GridFSManager.instance) {
      GridFSManager.instance = new GridFSManager();
    }
    return GridFSManager.instance;
  }

  /**
   * getBucket
   * @description
   * Returns the initialized GridFS bucket, creating it if necessary. This method ensures
   * that the database connection is established before bucket operations and provides
   * proper error handling for initialization failures.
   */
  async getBucket(): Promise<GridFSBucket> {
    if (this.isInitialized && this.bucket) {
      return this.bucket;
    }

    try {
      console.log('[FileUploadService.ts][3001] Initializing GridFS bucket');
      await connectDB();
      const db = mongoose.connection.db;

      if (!db) {
        throw new Error('Database connection not established');
      }

      this.bucket = new mongoose.mongo.GridFSBucket(db, {
        bucketName: 'files'
      });

      this.isInitialized = true;
      console.log('[FileUploadService.ts][3002] GridFS bucket initialized successfully');
      return this.bucket;
    } catch (error) {
      console.error('[FileUploadService.ts][3003] Failed to initialize GridFS bucket:', error);
      throw error;
    }
  }
}

/**
 * FileUploadService
 * @description
 * Main service class that provides centralized file upload functionality with comprehensive
 * permission validation, file processing, and storage operations. The service ensures consistent
 * enforcement of account-based restrictions while maintaining optimal performance through
 * efficient file handling and storage patterns.
 */
export class FileUploadService {
  private static gridFSManager = GridFSManager.getInstance();

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
   * Stores processed files in GridFS with comprehensive metadata including user context,
   * ownership tracking, and privacy controls. This method ensures proper access control
   * and supports the visibility scoping requirements for Scholar/Educator accounts.
   */
  static async storeFile(
    fileBuffer: Buffer,
    fileName: string,
    fileSize: number,
    userProfile: UserProfile,
    visibility: 'public' | 'private',
    originalMimeType: string,
    uploadContext?: string
  ): Promise<StoredFileResult> {
    console.log('[FileUploadService.ts][3021] Storing file with user context - Owner:', userProfile.email, 'Visibility:', visibility);

    try {
      const bucket = await this.gridFSManager.getBucket();

      // Step 8: Generate unique filename with user context
      const timestamp = Date.now();
      const filename = `${userProfile.accountType}_${timestamp}_${fileName}`;

      // Step 9: Create comprehensive metadata for access control and analytics
      const fileMetadata = {
        originalName: fileName,
        type: 'pdf',
        size: fileSize,
        owner: userProfile.email,
        visibility: visibility,
        accountType: userProfile.accountType,
        subscriptionTier: userProfile.subscriptionTier,
        originalMimeType: originalMimeType,
        uploadedAt: new Date(),
        uploadContext: uploadContext,
        // Step 10: Privacy scoping based on account policy
        scope: visibility === 'public'
          ? 'bloomdocx' // Public files scoped to .bloomdocx documents only
          : `bloomdocx_user_${userProfile.email}`, // Private files scoped to both .bloomdocx AND user
        // Step 11: Access control flags
        accessControl: {
          publicRead: visibility === 'public' && userProfile.accountType === 'educator',
          ownerRead: true,
          ownerWrite: true,
          ownerDelete: true
        }
      };

      const uploadStream = bucket.openUploadStream(filename, {
        contentType: 'application/pdf',
        metadata: fileMetadata
      });

      await new Promise<void>((resolve, reject) => {
        uploadStream.on('error', (error) => {
          console.error('[FileUploadService.ts][3022] GridFS upload error:', error);
          reject(error);
        });

        uploadStream.on('finish', () => {
          console.log('[FileUploadService.ts][3023] File stored successfully - ID:', uploadStream.id);
          resolve();
        });

        uploadStream.end(fileBuffer);
      });

      return {
        id: uploadStream.id.toString(),
        url: `/api/FileAssetsV2?id=${uploadStream.id}`,
        type: 'pdf',
        title: fileName,
        size: fileSize,
        visibility: visibility,
        owner: userProfile.email,
        uploadedAt: new Date(),
        metadata: {
          accountType: userProfile.accountType,
          subscriptionTier: userProfile.subscriptionTier,
          originalMimeType: originalMimeType,
          uploadContext: uploadContext
        }
      };

    } catch (error) {
      console.error('[FileUploadService.ts][3024] Error storing file:', error);
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
   * Validates whether a user can access a specific file based on ownership and visibility settings.
   * This method implements the privacy controls where private files are only accessible to their
   * owners and public files are accessible to all authenticated users.
   */
  static async checkFileAccess(fileId: string, userProfile: UserProfile): Promise<{
    allowed: boolean;
    file?: any;
    reason?: string;
  }> {
    console.log('[FileUploadService.ts][3030] Checking file access - File ID:', fileId, 'User:', userProfile.email);

    try {
      const bucket = await this.gridFSManager.getBucket();
      const objectId = new mongoose.Types.ObjectId(fileId);
      const file = await bucket.find({ _id: objectId }).next();

      if (!file) {
        console.log('[FileUploadService.ts][3031] File not found');
        return {
          allowed: false,
          reason: 'File not found'
        };
      }

      // Step 17: Check ownership for private files
      if (file.metadata?.visibility === 'private') {
        if (file.metadata?.owner !== userProfile.email) {
          console.log('[FileUploadService.ts][3032] Access denied - private file not owned by user');
          return {
            allowed: false,
            reason: 'Access denied: This is a private file'
          };
        }
      }

      // Step 18: Public files are accessible to all authenticated users
      console.log('[FileUploadService.ts][3033] File access granted');
      return {
        allowed: true,
        file: file
      };

    } catch (error) {
      console.error('[FileUploadService.ts][3034] Error checking file access:', error);
      return {
        allowed: false,
        reason: 'Error validating file access'
      };
    }
  }

  /**
   * deleteFile
   * @description
   * Securely deletes files with ownership validation to ensure only file owners can delete their
   * files. This method provides proper access control and prevents unauthorized deletions while
   * maintaining comprehensive audit logging for security purposes.
   */
  static async deleteFile(fileId: string, userProfile: UserProfile): Promise<{
    success: boolean;
    reason?: string;
  }> {
    console.log('[FileUploadService.ts][3035] Attempting file deletion - File ID:', fileId, 'User:', userProfile.email);

    try {
      const bucket = await this.gridFSManager.getBucket();

      // Step 19: Check access and ownership
      const accessCheck = await this.checkFileAccess(fileId, userProfile);
      if (!accessCheck.allowed) {
        console.log('[FileUploadService.ts][3036] File deletion denied - access check failed');
        return {
          success: false,
          reason: accessCheck.reason || 'Access denied'
        };
      }

      // Step 20: Additional ownership validation for deletion
      const file = accessCheck.file!;
      if (file.metadata?.owner !== userProfile.email) {
        console.log('[FileUploadService.ts][3037] File deletion denied - not owner');
        return {
          success: false,
          reason: 'Only file owners can delete files'
        };
      }

      // Step 21: Perform the deletion
      const objectId = new mongoose.Types.ObjectId(fileId);
      await bucket.delete(objectId);

      console.log('[FileUploadService.ts][3038] File deleted successfully');
      return { success: true };

    } catch (error) {
      console.error('[FileUploadService.ts][3039] Error deleting file:', error);
      return {
        success: false,
        reason: 'Error deleting file'
      };
    }
  }
}