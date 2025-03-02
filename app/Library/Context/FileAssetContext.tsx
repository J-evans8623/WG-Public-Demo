/**
 * @file FileAssetContext.tsx
 * @description
 *   Provides an interface for handling file uploads (PDF, DOC, DOCX, PPTX, TXT) in the frontend.
 *   Files are sent to the backend for processing (conversion to PDF and text extraction).
 *   Once processing is complete and a response is returned, the file is stored in a shared Y.Doc.
 *
 *   Responsibilities:
 *     - Validate and process file uploads.
 *     - Send the file to the backend and wait for the processed file URL.
 *     - Update shared state (and Y.Doc) only after a successful response.
 *     - Provide helper functions for file retrieval and caching.
 *
 *   Note: We now delay updating the file list until the backend responds, so that an incomplete
 *         (or unprocessed) file is not shown in the UI.
 *
 * @author  
 * @date    
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
import { TextFileMessage } from '../Definitions/Definitions';
import { v4 as uuidv4 } from 'uuid';

interface LessonSummary {
  moduleID: string;
  mainTopicTitle: string;
  summary: string;
}

export interface FileAssetContextType {
  files: Map<string, TextFileMessage>;
  lessonModuleLists: Map<string, LessonSummary[]>;
  addFile: (file: File) => Promise<void>;
  removeFile: (fileId: string) => Promise<void>;
  getAllFiles: () => TextFileMessage[];
  getFileById: (fileId: string) => TextFileMessage | undefined;
  getFileContent: (fileId: string) => Promise<string>;
  clearCache: (fileId: string) => void;
}

interface CachedContent {
  content: string;
  timestamp: number;
}

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

const FileAssetContext = createContext<FileAssetContextType | undefined>(undefined);

/**
 * fetchFileContent
 * @description Fetches the full content of a file from the server.
 *              For PDFs, returns the server URL; for HTML/TXT, returns the text content.
 * @param serverUrl - The URL to fetch the file from.
 * @param fileType - The type of file.
 * @returns Promise that resolves to the file content.
 */
const fetchFileContent = async (serverUrl: string, fileType: TextFileMessage['type']): Promise<string> => {
  const response = await fetch(serverUrl);
  if (!response.ok) {
    throw new Error('Failed to fetch file content');
  }
  return fileType === 'pdf' ? serverUrl : await response.text();
};

export const FileAssetProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { ydoc, docFileID } = useYDoc();
  const yFileMap = ydoc.getMap<TextFileMessage>('fileAssets');
  const [files, setFiles] = useState<Map<string, TextFileMessage>>(new Map());
  const [lessonModuleLists, setLessonModuleLists] = useState<Map<string, LessonSummary[]>>(new Map());
  const contentCache = useMemo(() => new Map<string, CachedContent>(), []);

  // ---------------------------------------------------------------------------
  // Initialize files from Y.js on mount and subscribe to changes.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const loadInitialFiles = () => {
      const initialFiles = new Map<string, TextFileMessage>();
      yFileMap.forEach((file, id) => {
        initialFiles.set(id, file);
      });
      setFiles(initialFiles);
    };

    loadInitialFiles();

    const updateListener = (events: Y.YEvent<any>[], transaction: Y.Transaction) => {
      if (transaction.origin?.type === 'system') return;
      const updatedFiles = new Map<string, TextFileMessage>();
      yFileMap.forEach((file, id) => {
        updatedFiles.set(id, file);
      });
      setFiles(updatedFiles);
    };

    yFileMap.observeDeep(updateListener);
    return () => yFileMap.unobserveDeep(updateListener);
  }, [yFileMap]);

  // ---------------------------------------------------------------------------
  // Utility functions to validate file MIME types.
  // ---------------------------------------------------------------------------
  const validateFileType = useCallback((file: File): boolean => {
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    return allowedTypes.includes(file.type);
  }, []);

  const getMimeTypeMapping = (mimeType: string): TextFileMessage['type'] => {
    const mapping: Record<string, TextFileMessage['type']> = {
      'application/pdf': 'pdf',
      'text/plain': 'txt',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx'
    };
    return mapping[mimeType] || 'txt';
  };

  // ---------------------------------------------------------------------------
  // addFile: Handles uploading a file, processing it, and storing file metadata.
  // ---------------------------------------------------------------------------
  const addFile = useCallback(async (file: File) => {
    try {
      // Step 1: Validate the file type.
      if (!validateFileType(file)) {
        throw new Error('Invalid file type. Only PDF, TXT, DOC, and DOCX files are allowed.');
      }

      // Step 2: Generate a unique ID.
      const resourceID = uuidv4();
      const fileId = docFileID!; // Provided by YDoc
      console.log('Invoking addFile with file id', fileId);

      // Step 3: Prepare the form data for file upload.
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileID', fileId);

      // Step 4: Call the backend API for file upload.
      const response = await fetch('/api/FileAssets', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload file');
      }

      // Step 5: Parse the API response.
      const responseData = await response.json();
      const { size, url, lessonModules } = responseData;
      console.log(`File uploaded. ID: ${resourceID}, Server URL: ${url}`);

      // Step 6: Build the final file message object using the server URL.
      const fileMessage: TextFileMessage = {
        id: resourceID,
        type: getMimeTypeMapping(file.type),
        title: file.name,
        serverUrl: url, // URL returned by backend (fully processed)
        uploadDate: new Date(),
        size
      };

      // Step 7: Update the shared Y.Doc with the file message.
      ydoc.transact(() => {
        yFileMap.set(fileMessage.id, fileMessage);
      });

      // Step 8: If lesson module metadata is returned, store it in state.
      if (lessonModules && Array.isArray(lessonModules)) {
        setLessonModuleLists(prev => {
          const newMap = new Map(prev);
          newMap.set(fileMessage.id, lessonModules);
          return newMap;
        });
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }, [ydoc, yFileMap, validateFileType, docFileID]);

  // ---------------------------------------------------------------------------
  // removeFile: Removes a file from storage and clears associated cached data.
  // ---------------------------------------------------------------------------
  const removeFile = useCallback(async (fileId: string) => {
    try {
      await fetch(`/api/FileAssets?id=${fileId}`, { method: 'DELETE' });
      ydoc.transact(() => {
        yFileMap.delete(fileId);
      });
      clearCache(fileId);
    } catch (error) {
      console.error('Error removing file:', error);
      throw error;
    }
  }, [ydoc, yFileMap]);

  // ---------------------------------------------------------------------------
  // Helper functions for file retrieval and caching.
  // ---------------------------------------------------------------------------
  const getAllFiles = useCallback(() => Array.from(files.values()), [files]);

  const getFileById = useCallback((fileId: string) => files.get(fileId), [files]);

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
   * @description Fetches the full content of a file.
   *              For PDFs, returns the server URL; for TXT/HTML, returns the text content.
   * @param fileId - The ID of the file.
   * @returns A promise resolving to the file content.
   */
  const getFileContent = useCallback(async (fileId: string): Promise<string> => {
    const file = files.get(fileId);
    if (!file) throw new Error('File not found');
    console.log(`Fetching content for file ID: ${fileId}, URL: ${file.serverUrl}`);
    const content = await fetchFileContent(file.serverUrl, file.type);
    setCachedContent(fileId, content);
    return content;
  }, [files, contentCache]);

  const clearCache = useCallback((fileId: string) => {
    contentCache.delete(fileId);
    console.log(`Cache cleared for file ID: ${fileId}`);
  }, [contentCache]);

  // ---------------------------------------------------------------------------
  // Expose context values.
  // ---------------------------------------------------------------------------
  const value = useMemo(() => ({
    files,
    lessonModuleLists,
    addFile,
    removeFile,
    getAllFiles,
    getFileById,
    getFileContent,
    clearCache,
  }), [files, lessonModuleLists, addFile, removeFile, getAllFiles, getFileById, getFileContent, clearCache]);

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
