import { LessonUnitsMeta } from '@/app/Library/Definitions/CalendarDefinitions';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * @interface UserFileMetadata
 * @description
 *   Represents a user's file metadata as stored in Firestore 'userFiles' collection.
 *   This replaces the deprecated DriveFile interface and aligns with your actual
 *   Firebase schema and FileMeta structure.
 */
export interface UserFileMetadata {
  fileId: string;           // Document ID (same as docFileID)
  ownerId: string;          // Email of the owner
  fileName: string;
  version:number;          // Display name of the file
  colorCode?: string;        // Use to personalize file card
  fileStoragePath: string;  // Firebase Storage path
  timestamp: Timestamp | string; // Creation/modification time
  fileSize: number;         // File size in bytes
  contentType: string;      // MIME type
  editors: string[];        // Array of editor emails
  sharedWith: string[];     // Array of all shared user emails
  publicEdit?: boolean;     // Whether anyone can edit
  publicView?: boolean;     // Whether anyone can view
  role?: 'Owner' | 'Editor' | 'Viewer';
  updatedAt: string;       // ISO string version of timestamp
  lessonUnitsMeta?: LessonUnitsMeta;
}

/**
 * @interface UserFilesResponse
 * @description
 *   Response structure from the /api/files/list endpoint
 */
export interface UserFilesResponse {
  ownedFiles: UserFileMetadata[];
  sharedFiles: UserFileMetadata[];
}