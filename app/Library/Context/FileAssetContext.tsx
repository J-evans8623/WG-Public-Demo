/**
 * @file FileAssetContext.tsx
 * @description
 *   Enhanced file asset context provider that manages privacy-aware file uploads, permissions, and filtering
 *   for the document management application. This context integrates with the new FileAssetsV2 endpoint to
 *   support scholar/educator account types with public/private file visibility controls. The context handles
 *   comprehensive permission validation, rate limiting, and error management while maintaining real-time
 *   collaboration through Y.js document storage. Files are stored in the Y.js document with enhanced metadata
 *   including visibility, ownership, and account type information, then filtered at read-time to ensure users
 *   only see files they have permission to access. Public files are visible to all document collaborators while
 *   private files are scoped to their owners. The context integrates with the centralized modal system for
 *   error handling and user feedback, providing contextual messages for rate limits, permission denials, and
 *   subscription upgrade prompts. All operations follow the principle of least privilege with client-side
 *   filtering backed by server-side validation for security.
 *
 * Responsibilities:
 *   - Manage file uploads to FileAssetsV2 endpoint with visibility controls
 *   - Filter files based on user permissions and ownership for privacy protection
 *   - Handle comprehensive error scenarios with appropriate modal displays
 *   - Integrate with account status management for permission validation
 *   - Maintain Y.js document consistency for real-time collaboration
 *   - Support file deletion with ownership validation
 *   - Cache file content for performance optimization
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  ReactNode
} from 'react';
import * as Y from 'yjs';
import { useYDoc } from './YDocContext';
import { useAccountStatus } from '@/app/src/context/ApiContext';
import { TextFileMessage } from '../Definitions/Definitions';
import { v4 as uuidv4 } from 'uuid';
import { useGlobalModal } from '@/app/studygraph/(studygraph)/components/modals/GlobalModalProvider';
import { supersedingCall } from '@/app/src/net/SupersedingCaller';

function buildUploadKey(docId: string | undefined | null) {
  // one lane per document so parallel docs don’t collide; if missing, fall back to a global lane
  return docId ? `fileUpload:doc:${docId}` : 'fileUpload:doc:unknown';
}

async function safeParseJson(resp: Response): Promise<any> {
  try { return await resp.json(); } catch { return { error: 'UNKNOWN', message: resp.statusText }; }
}

// Step 1: Enhanced interface definitions for privacy-aware file management
interface EnhancedTextFileMessage extends TextFileMessage {
  visibility: 'public' | 'private';
  ownerId: string;
  accountType: 'scholar' | 'educator';
  uploaderEmail?: string; // For backward compatibility
}

interface LessonSummary {
  moduleID: string;
  mainTopicTitle: string;
  summary: string;
}

interface FileUploadOptions {
  visibility?: 'public' | 'private';
  forcePrivate?: boolean;
}

interface CachedContent {
  content: string;
  timestamp: number;
}

// Step 2: Context interface with enhanced functionality
export interface FileAssetContextType {
  files: Map<string, EnhancedTextFileMessage>;
  lessonModuleLists: Map<string, LessonSummary[]>;
  addFile: (file: File, options?: FileUploadOptions) => Promise<void>;
  removeFile: (fileId: string) => Promise<void>;
  getAllFiles: () => EnhancedTextFileMessage[];
  getPublicFiles: () => EnhancedTextFileMessage[];
  getMyPrivateFiles: () => EnhancedTextFileMessage[];
  getFileById: (fileId: string) => EnhancedTextFileMessage | undefined;
  getFileContent: (fileId: string) => Promise<string>;
  clearCache: (fileId: string) => void;
  addGeneratedLessonFile: (fileMessage: TextFileMessage) => void;
  canUserSeeFile: (file: EnhancedTextFileMessage) => boolean;
  canUserDeleteFile: (file: EnhancedTextFileMessage) => boolean;
}

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const FileAssetContext = createContext<FileAssetContextType | undefined>(undefined);

/**
 * fetchFileContent
 * @description
 * Fetches the full content of a file from the server with enhanced error handling and security validation.
 * For PDFs, returns the server URL for direct viewing; for text files, returns the actual content.
 * @param serverUrl The URL to fetch the file from
 * @param fileType The type of file being fetched
 * @returns Promise resolving to file content or URL
 */
const fetchFileContent = async (serverUrl: string, fileType: TextFileMessage['type']): Promise<string> => {
  // console.log('[FileAssetContext.tsx][3001] Fetching file content from:', serverUrl);
  
  const response = await fetch(serverUrl, { credentials: 'include' });
  if (!response.ok) {
    console.error('[FileAssetContext.tsx][3002] File fetch failed:', response.status, response.statusText);
    throw new Error('Failed to fetch file content');
  }
  
  const result = fileType === 'pdf' ? serverUrl : await response.text();
  // console.log('[FileAssetContext.tsx][3003] File content retrieved successfully');
  return result;
};

export const FileAssetProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // console.log('[FileAssetContext.tsx][3004] FileAssetProvider initializing with enhanced privacy controls');
  
  // Step 3: Core context dependencies
  const { ydoc, docFileID } = useYDoc();
  const { accountStatus, hasFeature } = useAccountStatus();
  const { showModal } = useGlobalModal();
  const yFileMap = ydoc.getMap<EnhancedTextFileMessage>('fileAssets');
  
  // Step 4: State management
  const [files, setFiles] = useState<Map<string, EnhancedTextFileMessage>>(new Map());
  const [lessonModuleLists, setLessonModuleLists] = useState<Map<string, LessonSummary[]>>(new Map());
  const contentCache = useMemo(() => new Map<string, CachedContent>(), []);
  
  // Step 5: Get current user email for ownership validation
  const currentUserEmail = accountStatus?.email || 'unknown@example.com';

  // console.log('[FileAssetContext.tsx][3005] Current user context - Email:', currentUserEmail, 'Account type:', accountStatus?.accountType);

  /**
   * canUserSeeFile
   * @description
   * Determines if the current user can see a specific file based on visibility and ownership rules.
   * Public files are visible to all users; private files are only visible to their owners.
   * Time complexity: O(1) - simple permission check.
   * @param file The file to check permissions for
   * @returns Boolean indicating if user can see the file
   */
  const canUserSeeFile = useCallback((file: EnhancedTextFileMessage): boolean => {
    // Step 6: Public files are visible to everyone
    if (file.visibility === 'public') {
      // console.log('[FileAssetContext.tsx][3007] File visible - public access:', file.title);
      return true;
    }
    
    // Step 7: Private files only visible to owner
    const isOwner = file.ownerId === currentUserEmail || file.uploaderEmail === currentUserEmail;
    // console.log('[FileAssetContext.tsx][3008] Private file access check - File:', file.title, 'Is owner:', isOwner);
    return isOwner;
  }, [currentUserEmail]);

  /**
   * canUserDeleteFile
   * @description
   * Determines if the current user can delete a specific file. Only file owners can delete their files.
   * Time complexity: O(1) - simple ownership check.
   * @param file The file to check deletion permissions for
   * @returns Boolean indicating if user can delete the file
   */
  const canUserDeleteFile = useCallback((file: EnhancedTextFileMessage): boolean => {
    const canDelete = file.ownerId === currentUserEmail || file.uploaderEmail === currentUserEmail;
    // console.log('[FileAssetContext.tsx][3009] File deletion permission check - File:', file.title, 'Can delete:', canDelete);
    return canDelete;
  }, [currentUserEmail]);

  /**
   * getFilteredFiles
   * @description
   * Returns all files that the current user has permission to see, applying privacy filtering.
   * Time complexity: O(n) where n is the number of files - necessary for permission filtering.
   * @returns Array of files visible to the current user
   */
  const getFilteredFiles = useCallback((): EnhancedTextFileMessage[] => {
    const allFiles = Array.from(files.values());
    const visibleFiles = allFiles.filter(canUserSeeFile);
    // console.log('[FileAssetContext.tsx][3010] File filtering complete - Total:', allFiles.length, 'Visible:', visibleFiles.length);
    return visibleFiles;
  }, [files, canUserSeeFile]);

  /**
   * getPublicFiles
   * @description
   * Returns only public files visible to all users in the document.
   * Time complexity: O(n) - filters through all files for public visibility.
   * @returns Array of public files
   */
  const getPublicFiles = useCallback((): EnhancedTextFileMessage[] => {
    const publicFiles = Array.from(files.values()).filter(file => file.visibility === 'public');
    // console.log('[FileAssetContext.tsx][3011] Public files retrieved - Count:', publicFiles.length);
    return publicFiles;
  }, [files]);

  /**
   * getMyPrivateFiles
   * @description
   * Returns only private files owned by the current user.
   * Time complexity: O(n) - filters through all files for ownership and privacy.
   * @returns Array of user's private files
   */
  const getMyPrivateFiles = useCallback((): EnhancedTextFileMessage[] => {
    const myPrivateFiles = Array.from(files.values()).filter(file => 
      file.visibility === 'private' && canUserSeeFile(file)
    );
    // console.log('[FileAssetContext.tsx][3012] Private files retrieved - Count:', myPrivateFiles.length);
    return myPrivateFiles;
  }, [files, canUserSeeFile]);

  // Step 8: Initialize and sync files from Y.js (CLEANED - no migration logic)
  useEffect(() => {
    // console.log('[FileAssetContext.tsx][3013] Initializing file sync from Y.js document');
    
    const loadInitialFiles = () => {
      const initialFiles = new Map<string, EnhancedTextFileMessage>();
      yFileMap.forEach((file, id) => {
        // Files in Y.js are expected to already have enhanced metadata
        initialFiles.set(id, file);
      });
      setFiles(initialFiles);
      // console.log('[FileAssetContext.tsx][3014] Initial files loaded - Count:', initialFiles.size);
    };

    loadInitialFiles();

    const updateListener = (events: Y.YEvent<any>[], transaction: Y.Transaction) => {
      if (transaction.origin?.type === 'system') return;
      
      const updatedFiles = new Map<string, EnhancedTextFileMessage>();
      yFileMap.forEach((file, id) => {
        // Files in Y.js are expected to already have enhanced metadata
        updatedFiles.set(id, file);
      });
      setFiles(updatedFiles);
      // console.log('[FileAssetContext.tsx][3015] Files updated from Y.js sync - Count:', updatedFiles.size);
    };

    yFileMap.observeDeep(updateListener);
    return () => yFileMap.unobserveDeep(updateListener);
  }, [yFileMap]);

  /**
   * validateFileType
   * @description
   * Validates that the uploaded file is of an allowed type for the platform.
   * Supports PDF, text, Word documents, and PowerPoint presentations.
   * @param file The file to validate
   * @returns Boolean indicating if file type is allowed
   */
  const validateFileType = useCallback((file: File): boolean => {
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    const isValid = allowedTypes.includes(file.type);
    // console.log('[FileAssetContext.tsx][3016] File type validation - File:', file.name, 'Type:', file.type, 'Valid:', isValid);
    return isValid;
  }, []);

  /**
   * handleUploadError
   * @description
   * Processes upload errors and displays appropriate modals based on error type and user context.
   * Provides contextual guidance for rate limits, permission denials, and subscription upgrades.
   * @param error The error response from the upload attempt
   * @param fileName The name of the file that failed to upload
   */
  const handleUploadError = useCallback((error: any, fileName: string) => {
    console.error('[FileAssetContext.tsx][3017] Upload error for file:', fileName, 'Error:', error);
    
    // Step 9: Parse error response
    const errorCode = error.code || error.error || 'UNKNOWN_ERROR';
    const errorMessage = error.message || error.reason || 'An unknown error occurred';
    
    // console.log('[FileAssetContext.tsx][3018] Processing upload error - Code:', errorCode, 'Message:', errorMessage);

    // Step 10: Handle specific error types with appropriate modals
    if (errorCode.includes('RATE_LIMIT') || errorMessage.includes('rate limit')) {
      showModal('rateLimit', {
        retryAfter: error.retryAfter || 60,
      });
    } else if (errorCode.includes('UPLOAD_DENIED') || errorMessage.includes('permission')) {
      showModal('subscribe', {
        featureName: 'File Upload',
      });
    } else if (errorMessage.includes('demo credits')) {
      showModal('subscribe', {
        featureName: 'Additional Uploads',
      });
    } else {
      // Generic error - could add a general error modal here if available
      console.error('[FileAssetContext.tsx][3024] Unhandled upload error type:', errorCode);
      alert(`Upload failed: ${errorMessage}`); // Fallback for unhandled errors
    }
  }, [showModal]);

  /**
   * addFile
   * @description
   * Enhanced file upload function that integrates with FileAssetsV2 endpoint and privacy controls.
   * Handles permission validation, visibility selection, error processing, and Y.js document updates.
   * Scholar accounts are enforced to use private visibility regardless of user selection.
   * @param file The file to upload
   * @param options Upload options including visibility preferences
   * @returns Promise that resolves when upload is complete
   */
/**
 * addFile
 * @description
 *   Enhanced file upload function that integrates with FileAssetsV2 endpoint and privacy controls.
 *   Now routes uploads through `supersedingCall` so:
 *   1) A 429 schedules a single retry using `Retry-After`.
 *   2) Picking a new file before the retry fires supersedes the queued one (stale flushed).
 *   3) An in-flight upload is aborted if a newer one starts.
 */
const addFile = useCallback(async (file: File, options: FileUploadOptions = {}) => { // ✨ update - 3
  // console.log('[FileAssetContext.tsx][3025] Starting enhanced file upload - File:', file.name, 'Options:', options);

  // (pre-existing logic) validate type, resolve visibility, ids, etc...
  if (!validateFileType(file)) throw new Error('Invalid file type. Only PDF, TXT, DOC, DOCX, and PPTX files are allowed.');
  const currentAccountType = accountStatus?.accountType || 'scholar';

  let visibility: 'public' | 'private' = 'private';
  if (options.forcePrivate) {
    visibility = 'private';
  } else if (currentAccountType === 'scholar') {
    visibility = 'private';
  } else if (options.visibility === 'public' && hasFeature('canCreatePublicFiles')) {
    visibility = 'public';
  }

  const resourceID = uuidv4();
  const docFileid = docFileID!;
  const fileId = uuidv4();

  // --- NEW: superseding caller wiring --------------------------------------
  const key = buildUploadKey(docFileid);

  /**
   * makeRequest — used by supersedingCall for first attempt + any timed retry
   * @steps
   *  1) Rebuild FormData fresh each attempt (Files/FormData must be recreated).
   *  2) POST to /api/FileAssetsV2 with AbortSignal wired in.
   */
  const makeRequest = async (signal: AbortSignal, payload: any): Promise<Response> => {
    const fd = new FormData();
    fd.append('file', payload.file as File);
    fd.append('DocID', docFileid);
    fd.append('fileID', fileId);
    fd.append('visibility', visibility);
    return fetch('/api/FileAssetsV2', {
      method: 'POST',
      body: fd,
      credentials: 'include',
      signal,
    });
  };

  try {
    // Call via superseding lane — respects 429 Retry-After & flushes stale if a new file arrives
    const resp = await supersedingCall(key, { file }, makeRequest);

    // If superseded (null) or deferred due to Retry-After, do nothing; retry is scheduled already.
    if (!resp) {
      // console.log('[FileAssetContext.tsx] upload superseded/deferred; latest snapshot will run.');
      return;
    }

    if (!resp.ok) {
      // 429 path: the retry is already scheduled by supersedingCall; other errors bubble to handler
      const errorData = await safeParseJson(resp);
      console.error('[FileAssetContext.tsx] Upload request failed:', resp.status, errorData);
      handleUploadError(errorData, file.name);
      return;
    }

    const responseData = await resp.json();
    // console.log('[FileAssetContext.tsx][3034] Upload successful - Response:', responseData);

    // Store in Y.js (unchanged semantics)
    const enhancedFileMessage: EnhancedTextFileMessage = {
      id: resourceID,
      type: file.type === 'application/pdf' ? 'pdf' : 'txt',
      title: file.name,
      serverUrl: responseData.url,
      uploadDate: new Date(),
      size: responseData.size,
      visibility,
      ownerId: currentUserEmail,
      accountType: currentAccountType,
      uploaderEmail: currentUserEmail
    };

    ydoc.transact(() => {
      yFileMap.set(enhancedFileMessage.id, enhancedFileMessage);
    });

    // console.log('[FileAssetContext.tsx][3035] File stored in Y.js with privacy metadata', { id: resourceID, visibility });

  } catch (error) {
    console.error('[FileAssetContext.tsx][3036] File upload error:', error);
    handleUploadError(error, file.name);
    throw error;
  }
}, [ydoc, yFileMap, validateFileType, docFileID, currentUserEmail, accountStatus, hasFeature, handleUploadError]);

  /**
   * removeFile
   * @description
   * Enhanced file removal function with ownership validation and secure deletion from both server and Y.js.
   * Only allows file owners to delete their files, maintaining security and preventing unauthorized deletions.
   * @param fileId The ID of the file to remove
   * @returns Promise that resolves when deletion is complete
   */
  const removeFile = useCallback(async (fileId: string) => {
    // console.log('[FileAssetContext.tsx][3037] Starting file removal - File ID:', fileId);
    
    try {
      const file = files.get(fileId);
      if (!file) {
        throw new Error('File not found');
      }

      // Step 18: Validate deletion permissions
      if (!canUserDeleteFile(file)) {
        console.error('[FileAssetContext.tsx][3038] File deletion denied - user not owner');
        throw new Error('You can only delete files you uploaded');
      }

      // Step 19: Delete from server
      const response = await fetch(`/api/FileAssetsV2?id=${fileId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[FileAssetContext.tsx][3039] Server deletion failed:', response.status, errorData);
        throw new Error(errorData.message || 'Failed to delete file from server');
      }

      // Step 20: Remove from Y.js document
      ydoc.transact(() => {
        yFileMap.delete(fileId);
      });

      // Step 21: Clear any cached content
      clearCache(fileId);
      
      // console.log('[FileAssetContext.tsx][3040] File deletion completed successfully - ID:', fileId);

    } catch (error) {
      console.error('[FileAssetContext.tsx][3041] Error removing file:', error);
      throw error;
    }
  }, [ydoc, yFileMap, files, canUserDeleteFile]);

  // Step 22: File retrieval and caching functions (enhanced with permission checking)
  const getFileById = useCallback((fileId: string) => {
    const file = files.get(fileId);
    if (file && canUserSeeFile(file)) {
      // console.log('[FileAssetContext.tsx][3042] File retrieved by ID:', fileId);
      return file;
    }
    console.warn('[FileAssetContext.tsx][3043] File access denied or not found:', fileId);
    return undefined;
  }, [files, canUserSeeFile]);

  const getCachedContent = (fileId: string): string | null => {
    const cachedData = contentCache.get(fileId);
    if (!cachedData) return null;
    if (Date.now() - cachedData.timestamp > CACHE_DURATION) {
      contentCache.delete(fileId);
      return null;
    }
    return cachedData.content;
  };

  const setCachedContent = (fileId: string, content: string) => {
    contentCache.set(fileId, { content, timestamp: Date.now() });
  };

  /**
   * getFileContent
   * @description
   * Enhanced file content retrieval with permission validation and caching optimization.
   * Only allows access to files the user has permission to see, maintaining privacy controls.
   * @param fileId The ID of the file to retrieve content for
   * @returns Promise resolving to file content or URL
   */
  const getFileContent = useCallback(async (fileId: string): Promise<string> => {
    // console.log('[FileAssetContext.tsx][3044] Retrieving file content - ID:', fileId);
    
    const file = files.get(fileId);
    if (!file || !canUserSeeFile(file)) {
      console.error('[FileAssetContext.tsx][3045] File content access denied - ID:', fileId);
      throw new Error('File not found or access denied');
    }

    // Check cache first
    const cached = getCachedContent(fileId);
    if (cached) {
      // console.log('[FileAssetContext.tsx][3046] File content served from cache - ID:', fileId);
      return cached;
    }

    const content = await fetchFileContent(file.serverUrl, file.type);
    setCachedContent(fileId, content);
    // console.log('[FileAssetContext.tsx][3047] File content retrieved and cached - ID:', fileId);
    return content;
  }, [files, canUserSeeFile]);

  const clearCache = useCallback((fileId: string) => {
    contentCache.delete(fileId);
    // console.log('[FileAssetContext.tsx][3048] File cache cleared - ID:', fileId);
  }, [contentCache]);

  /**
   * addGeneratedLessonFile
   * @description
   * Enhanced function to add AI-generated lesson files with proper privacy metadata assignment
   * that respects Scholar account constraints. Scholar accounts ALWAYS get private files,
   * regardless of their subscription tier or permissions.
   * @param fileMessage The generated file message from the backend
   */
  const addGeneratedLessonFile = useCallback((fileMessage: TextFileMessage) => {
    // console.log('[FileAssetContext.tsx][3049] Adding generated lesson file - ID:', fileMessage.id);
    
    // Get current account type
    const currentAccountType = accountStatus?.accountType || 'scholar';


  // console.log('8932 DEBUG - accountStatus:', accountStatus);
  // console.log('8932 DEBUG - currentAccountType:', currentAccountType);
  // console.log('8932 DEBUG - hasFeature canCreatePublicFiles:', hasFeature('canCreatePublicFiles'));
    
    // Scholar accounts ALWAYS get private files, regardless of features
    let visibility: 'public' | 'private';
    if (currentAccountType === 'scholar') {
      visibility = 'private'; // Force private for all Scholar accounts

      // console.log('8932 DEBUG - Scholar detected, visibility set to:', visibility);
      // console.log('[FileAssetContext.tsx][3050] Generated lesson forced to private for Scholar account');
    } else {
      // Educators can have public files if they have the feature
      visibility = hasFeature('canCreatePublicFiles') ? 'public' : 'private';
      // console.log('[FileAssetContext.tsx][3051] Generated lesson visibility for Educator:', visibility);
    }

    // Step 23: Enhance generated file with correct privacy metadata
    const enhancedFile: EnhancedTextFileMessage = {
      ...fileMessage,
      visibility: visibility,
      ownerId: currentUserEmail,
      accountType: currentAccountType,
      uploaderEmail: currentUserEmail
    };

    ydoc.transact(() => {
      yFileMap.set(enhancedFile.id, enhancedFile);
    });

    // console.log('[FileAssetContext.tsx][3052] Generated lesson file stored with correct privacy metadata - Visibility:', enhancedFile.visibility, 'Account type:', currentAccountType);
  }, [ydoc, yFileMap, currentUserEmail, accountStatus, hasFeature]);

  // Step 24: Expose enhanced context API
  const value = useMemo(() => ({
    files,
    lessonModuleLists,
    addFile,
    removeFile,
    getAllFiles: getFilteredFiles,
    getPublicFiles,
    getMyPrivateFiles,
    getFileById,
    getFileContent,
    clearCache,
    addGeneratedLessonFile,
    canUserSeeFile,
    canUserDeleteFile,
  }), [
    files,
    lessonModuleLists,
    addFile,
    removeFile,
    getFilteredFiles,
    getPublicFiles,
    getMyPrivateFiles,
    getFileById,
    getFileContent,
    clearCache,
    addGeneratedLessonFile,
    canUserSeeFile,
    canUserDeleteFile,
  ]);

  // console.log('[FileAssetContext.tsx][3053] FileAssetProvider ready with enhanced privacy controls');

  return (
    <FileAssetContext.Provider value={value}>
      {children}
    </FileAssetContext.Provider>
  );
};

export const useFileAsset = () => {
  const context = useContext(FileAssetContext);
  if (!context) {
    throw new Error('useFileAsset must be used within FileAssetProvider');
  }
  return context;
};